import { AuthorizationModel, CheckRequestTupleKey, Condition, ListObjectsRequest, RelationReference, TupleKey, TypeDefinition } from "@openfga/sdk";
import Ajv, { Schema, ValidateFunction, SchemaValidateFunction } from "ajv";


type Store = {
  name: string
  model_file?: string
  model?: string
  tuple_files?: string
  tuples: TupleKey[]
  tests: Test[]
}

type Test = {
  tuples: TupleKey[]
  check: CheckTest[]
  list_objects: ListObjectTest[]
}

type CheckTest = Omit<CheckRequestTupleKey, "relation"> & {
  assertions: Record<string, boolean>
  context: Record<string, any>
}

type ListObjectTest = Omit<ListObjectsRequest, "relation"> & {
  assertions: Record<string, boolean>
}

type BaseError = { keyword: string; message: string; instancePath: string; }

// Errors for tuples validation
const invalidTuple = (message: string, instancePath: string): BaseError => {
  return {
    keyword: "valid_tuple",
    message,
    instancePath
  };
};

const invalidType = (user: string, types: string[], instancePath: string) => {
  return invalidTuple(`invalid type '${user}'. Valid types are [${types}]`, instancePath);
};

const relationMustExistOnType = (relation: string, type: string, instancePath: string) => {
  return invalidTuple(`relation '${relation}' is not a relation on type '${type}'.`, instancePath);
};

const userNotTypeRestriction = (user: string, tuple: TupleKey, instancePath: string) => {
  return invalidTuple(`'${user}' is not a type restriction on relation '${tuple.relation}' of type '${tuple.object.split(":")[0]}'.`, instancePath + "/user");
};

const conditionDoesntExist = (tuple: TupleKey, instancePath: string) => {
  return invalidTuple(`condition '${tuple.condition?.name}' is not defined.`, instancePath + "/condition/name");
};

const notAParameter = (param: string, tuple: TupleKey, instancePath: string) => {
  return invalidTuple(`'${param}' is not a parameter on condition '${tuple.condition?.name}'.`, instancePath + `/condition/context/${param}`);
};

// Errors for store validation
const invalidStore = (message: string, instancePath: string) => {
  return {
    keyword: "valid_store",
    message,
    instancePath,
  };
};

const modelOrModelFile = (instancePath: string) => {
  return invalidStore("'model' or 'model_file' must be presenet keys.", instancePath);
};

const invalidUserField = (instancePath: string) => {
  return invalidStore("`user` field must be one of [<type>:<id>, <type>:* or <type>:<id>#<relation>]", instancePath);
};

const invalidTypeUser = (type: string, types: string[], instancePath: string) => {
  return invalidStore(`invalid type '${type}'. Valid types are [${types}]`, instancePath);
};

const nonMatchingRelationType = (relation: string, user: string, values: string[], instancePath: string) => {
  if (values.length) {
    return invalidStore(`\`${relation}\` is not a relation on \`${user}\`, and does not exist in model - valid relations are [${values}].`, instancePath);

  }
  return invalidStore(`\`${relation}\` is not a relation on \`${user}\`, and does not exist in model.`, instancePath);
};

const invalidAssertion = (assertion: string, object: string, instancePath: string) => {
  return invalidStore(`\`${assertion}\` is not a relationship for type \`${object}\`.`, instancePath);
};

const unidentifiedTestParam = (testParam: string, instancePath: string) => {
  return invalidStore(`\`${testParam}\` is not a recognized paramaeter for any condition defined in the model.`, instancePath);
};

const undefinedUserTuple = (user: string, instancePath: string) => {
  return {
    keyword: "valid_store_warning",
    message: `${user} does not match any existing tuples; the check is still valid - but double check to ensure this is intended.`,
    instancePath: instancePath + "/user"
  };
};

// Format enforcement
const identifier = "[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?";

const formatField = (field: string, regex: string, length: number) => {
  if (!field.match(new RegExp(regex) || field.length > length)) {
    return false;
  }
  return true;
};

function formatUser(user: string): boolean {
  return formatField(user, `^${identifier}:(\\*|${identifier}(#${identifier})?)$`, 512);
}

function formatRelation(relation: string): boolean {
  return formatField(relation, `^${identifier}$`, 50);
}

function formatObject(object: string): boolean {
  return formatField(object, `^${identifier}:${identifier}$`, 256);
}

function formatCondition(condition: string): boolean {
  return formatField(condition, `^${identifier}$`, 50);
}

function formatType(type: string): boolean {
  return formatField(type, `^${identifier}$`, 256);
}

// Validation for Types

function validateTypes(tuple: TupleKey, types: string[], instancePath: string): boolean {
  const errors = [];

  const user = tuple.user.split(":")[0];

  // Ensure valid type of user
  if (!types.includes(user)) {
    errors.push(invalidType(user, types, instancePath + "/user"));
  }

  const object = tuple.object.split(":")[0];

  // Ensure valid type of object
  if (!types.includes(object)) {
    errors.push(invalidType(object, types, instancePath + "/object"));
  }

  // Report all errors
  if (errors.length) {
    validateTuple.errors?.push(...errors);
    return false;
  }
  return true;
}

// Validate Relation
function validateRelation(tuple: TupleKey, typeDefs: TypeDefinition[], instancePath: string): boolean {
  const errors = [];

  // Check if relation exists on given type
  let doesExistOnType = false;
  if (tuple.user.includes("#")) {
    const user = tuple.user.split(":")[0];
    const userRelation = tuple.user.split("#")[1];
    for (const typeDef of typeDefs) {
      if (typeDef && typeDef.type === user && typeDef.relations?.[userRelation]) {
        doesExistOnType = true;
        break;
      }
    }

    if (!doesExistOnType) {
      errors.push(relationMustExistOnType(userRelation, user, instancePath + "/user"));
    }
  }

  // Check if relation exists on given object
  const objectType = tuple.object.split(":")[0];
  let doesExistOnObject = false;
  for (const typeDef of typeDefs) {
    if (typeDef && typeDef.type === objectType && typeDef.relations?.[tuple.relation]) {
      doesExistOnObject = true;
      break;
    }
  }
  if (!doesExistOnObject) {
    errors.push(relationMustExistOnType(tuple.relation, objectType, instancePath + "/relation"));
  }

  if (errors.length) {
    validateTuple.errors?.push(...errors);
    return false;
  }
  return true;
}

function mapTuple(tuple: TupleKey): RelationReference {
  return {
    type: tuple.user.split(":")[0],
    relation: tuple.user.includes("#") ? tuple.user.split("#")[1] : undefined,
    wildcard: tuple.user.includes(":*") ? {} : undefined,
    condition: tuple.condition?.name,
  };
}

function getRelationReferenceString(relationReference: RelationReference) {
  let relationReferenceString = relationReference.type;
  if (relationReference.wildcard) {
    relationReferenceString += ":*";
  } else if (relationReference.relation) {
    relationReferenceString += `#${relationReference.relation}`;
  }

  if (relationReference.condition) {
    relationReferenceString += `' with '${relationReference.condition}`;
  }

  return relationReferenceString;
}

function validateTypeRestrictions(
  tuple: TupleKey,
  typeDefs: TypeDefinition[],
  conditions: Record<string, Condition> | undefined,
  instancePath: string,
): boolean {
  validateTuple.errors = validateTuple.errors || [];

  const mappedTuple = mapTuple(tuple);
  const object = tuple.object.split(":")[0];
  const type = typeDefs.filter((t) => t.type === object)[0];

  const userTypes = type?.metadata?.relations?.[tuple.relation].directly_related_user_types;

  if (
    !userTypes?.filter(
      (userType) =>
        userType.type === mappedTuple.type && // type matches
        !!mappedTuple.wildcard === !!userType.wildcard && // and the wildcard matches (either both true or both false)
        userType.relation === mappedTuple.relation && // and the relation matches
        userType.condition === mappedTuple.condition, // and the condition matches
    ).length
  ) {
    validateTuple.errors.push(userNotTypeRestriction(getRelationReferenceString(mappedTuple), tuple, instancePath));
    return false;
  }

  if (mappedTuple.condition && conditions) {
    // Check parameters for matching condition
    return validateConditionParams(tuple, mappedTuple.condition, conditions, instancePath);
  }
  return true;
}

function validateConditionExists(
  tuple: TupleKey,
  conditions: Record<string, Condition> | undefined,
  instancePath: string,
): boolean {
  if (!tuple.condition) {
    return true;
  }

  validateTuple.errors = validateTuple.errors || [];

  // Condition on tuple not found
  if (!conditions || !conditions[tuple.condition.name]) {
    validateTuple.errors.push(conditionDoesntExist(tuple, instancePath));
    return false;
  }
  return true;
}

function validateConditionParams(
  tuple: TupleKey,
  condition: string,
  conditions: Record<string, Condition>,
  instancePath: string,
): boolean {
  validateTuple.errors = validateTuple.errors || [];

  if (tuple.condition && tuple.condition.context && conditions[condition].parameters) {
    for (const param of Object.keys(tuple.condition.context)) {
      if (!conditions[condition].parameters![param]) {
        validateTuple.errors.push(notAParameter(param, tuple, instancePath));
        return false;
      }
    }
  }
  return true;
}

// Validation for tuples
const validateTuple: SchemaValidateFunction = function (
  this: { jsonModel: AuthorizationModel },
  tuple: TupleKey,
  cxt: { instancePath: string },
): boolean {
  validateTuple.errors = validateTuple.errors || [];

  if (!tuple.user || !tuple.relation || !tuple.object) {
    return false;
  }

  const jsonModel: AuthorizationModel = this.jsonModel;

  // Validate
  const types = jsonModel.type_definitions.map((d) => d.type);
  return (
    validateTypes(tuple, types, cxt.instancePath) &&
    validateRelation(tuple, jsonModel.type_definitions, cxt.instancePath) &&
    validateConditionExists(tuple, jsonModel.conditions, cxt.instancePath) &&
    validateTypeRestrictions(tuple, jsonModel.type_definitions, jsonModel.conditions, cxt.instancePath)
  );
};

// Validate the user field for check and list_objects
function validateUserField(model: AuthorizationModel, types: string[], userField: string, instancePath: string) {
  const errors = [];
  const user = userField.split(":")[0];

  // Ensure valid type of user
  if (!types.includes(user)) {
    errors.push(invalidUserField(instancePath + "/user"));
    errors.push(invalidTypeUser(user, types, instancePath + "/user"));
  }

  // Valdidate check user
  if (userField.includes("#")) {
    const [type, relation] = userField.split("#");

    const userRelations = model.type_definitions.filter(typeDef => typeDef.type === user).flatMap((typeDef) => {
      const relationArray: string[] = [];
      for(const rel in typeDef.relations) {
        relationArray.push(type + "#" + rel);
      }
      return relationArray;
    });

    if (!userRelations.includes(userField)) {
      errors.push(nonMatchingRelationType(relation, user, userRelations.map(rel => rel.split("#")[1]), instancePath + "/user"));
    }

  }
  return errors;
}

function validateAssertionField(model: AuthorizationModel, typeField: string, assertions: Record<string, any>, instancePath: string) {
  const errors = [];

  // Validate assertions exist as relations
  const typesRelations = model.type_definitions.filter(tuple => tuple.type === typeField).map(tuple => tuple.relations);
  for (const assertion in assertions) {
    for (const relation in typesRelations) {
      if (!typesRelations[relation]?.[assertion]) {
        errors.push(invalidAssertion(assertion, typeField, instancePath + `/assertions/${assertion}`));
      }
    }
  }

  return errors;
}

// Validate Check Tuple
function validateCheck(model: AuthorizationModel, checkTest: CheckTest, tuples: TupleKey[], params: string[], instancePath: string) {
  const errors = [];

  const types = model.type_definitions.map(d => d.type);

  const checkUser = checkTest.user;
  const checkObject = checkTest.object;

  errors.push(...validateUserField(model, types, checkUser, instancePath));

  if (!errors.length ) {
    if(!tuples.map(tuple => tuple.user).filter(user => user === checkUser).length) {
      errors.push(undefinedUserTuple(checkUser, instancePath));
    }
  }

  const object = checkObject.split(":")[0];

  // Ensure valid type of object
  if (!types.includes(object)) {
    errors.push(invalidTypeUser(object, types, instancePath + "/object"));
  }

  errors.push(...validateAssertionField(model, object, checkTest.assertions, instancePath));

  const context = checkTest.context;
  for (const testParam in context) {
    if (!params.includes(testParam)) {
      errors.push(unidentifiedTestParam(testParam, instancePath + `/context/${testParam}`));
    }
  }

  return errors;
}

// Validate List Object
function validateListObject(model: AuthorizationModel, listObjects: ListObjectTest, tuples: TupleKey[], params: string[], instancePath: string) {
  const errors = [];

  const types = model.type_definitions.map(d => d.type);

  const listUser = listObjects.user;
  const listType = listObjects.type;

  errors.push(...validateUserField(model, types, listUser, instancePath));

  if (!errors.length ) {
    if(!tuples.map(tuple => tuple.user).filter(user => user === listUser).length) {
      errors.push(undefinedUserTuple(listUser, instancePath));
    }
  }

  // Ensure valid type of object
  if (!types.includes(listType)) {
    errors.push(invalidTypeUser(listType, types, instancePath + "/type"));
  }

  // Validate assertions exist as relations
  errors.push(...validateAssertionField(model, listType, listObjects.assertions, instancePath));

  const context = listObjects.context;
  for (const testParam in context) {
    if (!params.includes(testParam)) {
      errors.push(unidentifiedTestParam(testParam, instancePath + `/context/${testParam}`));
    }
  }
  return errors;
}

// Validation for types in check
function validateTestTypes(store: Store, model: AuthorizationModel, instancePath: string): boolean {
  const errors = [];

  // Collect params for validity checking
  const params: string[] = [];
  for (const condition in model.conditions) {
    for (const param in model.conditions[condition].parameters) {
      params.push(param);
    }
  }

  for (const testNo in store.tests) {
    // Collect valid tuples
    const tuples = [];
    if (store.tuples && store.tuples.length) {
      tuples.push(...store.tuples);
    }

    const test = store.tests[testNo];

    if (test.tuples && test.tuples.length) {
      tuples.push(...test.tuples);
    }

    // Validate check
    for (const checkNo in test.check) {
      if (!test.check[checkNo].user || !test.check[checkNo].object) {
        return false;
      }
      errors.push(...validateCheck(model, test.check[checkNo], tuples, params, instancePath + `/tests/${testNo}/check/${checkNo}`));
    }

    // Validate list objects
    for (const listNo in test.list_objects) {
      if (!test.list_objects[listNo].user || !test.list_objects[listNo].type) {
        return false;
      }
      errors.push(...validateListObject(model, test.list_objects[listNo], tuples, params, instancePath + `/tests/${testNo}/list_objects/${listNo}`));
    }
  }

  if (errors.length) {
    validateStore.errors?.push(...errors);
    return false;
  }
  return true;
}

const validateStore: SchemaValidateFunction = function (this: { jsonModel: AuthorizationModel }, store: Store, cxt: { instancePath: string }): boolean {
  validateStore.errors = validateStore.errors || [];

  // Require model or model_file
  if (!store.model && !store.model_file) {
    validateStore.errors.push(modelOrModelFile(cxt.instancePath));
    return false;
  }

  return validateTestTypes(store, this.jsonModel, cxt.instancePath);
};

// YAML validation using ajv
export function YamlStoreValidator(): ValidateFunction {
  return new Ajv({
    allErrors: true,
    verbose: true,
    passContext: true,
    $data: true,
  })
    .addFormat("user", {
      validate: formatUser,
    })
    .addFormat("relation", {
      validate: formatRelation,
    })
    .addFormat("object", {
      validate: formatObject,
    })
    .addFormat("condition", {
      validate: formatCondition,
    })
    .addFormat("type", {
      validate: formatType,
    })
    .addKeyword({
      keyword: "valid_tuple",
      type: "object",
      schema: false,
      errors: true,
      validate: validateTuple,
    })
    .addKeyword({
      keyword: "valid_store",
      type: "object",
      schema: false,
      errors: true,
      validate: validateStore,
    })
    .compile(OPENFGA_YAML_SCHEMA);
}

// YAML Schema
const OPENFGA_YAML_SCHEMA: Schema = {
  type: "object",
  required: ["tests"],
  additionalProperties: false,
  valid_store: true,
  properties: {
    name: {
      type: "string",
      description: "the store name",
    },
    model_file: {
      type: "string",
      description: "the authorization model file path",
    },
    model: {
      type: "string",
      description: "the authorization model (takes precedence over model_file)",
    },
    tuples_file: {
      type: "string",
      description: "the tuples file path",
    },
    tuples: {
      type: "array",
      description: "the tuples (takes precedence over tuples_file)",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["user", "relation", "object"],
        valid_tuple: true,
        properties: {
          user: {
            type: "string",
            format: "user",
            description: "the user",
          },
          relation: {
            type: "string",
            format: "relation",
            description: "the relation",
          },
          object: {
            type: "string",
            format: "object",
            description: "the object",
          },
          condition: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: {
              name: {
                type: "string",
                format: "condition",
              },
              context: {
                type: "object",
              },
            },
          },
        },
      },
    },
    tests: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "the test name",
          },
          description: {
            type: "string",
            description: "the test description",
          },
          tuples_file: {
            type: "string",
            description: "the tuples file with additional tuples for this test",
          },
          tuples: {
            type: "array",
            description: "the additional tuples for this test (takes precedence over tuples_file)",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["user", "relation", "object"],
              valid_tuple: true,
              properties: {
                user: {
                  type: "string",
                  format: "user",
                  description: "the user",
                },
                relation: {
                  type: "string",
                  format: "relation",
                  description: "the relation",
                },
                object: {
                  type: "string",
                  format: "object",
                  description: "the object",
                },
                condition: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name"],
                  properties: {
                    name: {
                      type: "string",
                      format: "condition",
                    },
                    context: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
          check: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["user", "object", "assertions"],
              properties: {
                user: {
                  type: "string",
                  format: "user",
                  description: "the user",
                },
                object: {
                  type: "string",
                  format: "object",
                  description: "the object",
                },
                assertions: {
                  type: "object",
                  patternProperties: {
                    ".*": {
                      type: "boolean",
                    },
                  },
                },
                context: {
                  type: "object",
                },
              },
            },
          },
          list_objects: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["user", "type", "assertions"],
              properties: {
                user: {
                  type: "string",
                  format: "user",
                  description: "the user",
                },
                relation: {
                  type: "string",
                  format: "relation",
                  description: "the relation",
                },
                type: {
                  type: "string",
                  format: "type",
                  description: "the object type",
                },
                assertions: {
                  type: "object",
                  patternProperties: {
                    ".*": {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },
                  },
                },
                context: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
  },
};
