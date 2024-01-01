import { AuthorizationModel, Condition, RelationReference, TupleKey, TypeDefinition } from "@openfga/sdk";
import Ajv, { Schema, ValidateFunction, SchemaValidateFunction } from "ajv";

const identifier = "[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?";

// Errors for tuples validation
const invalidType = (user: string, types: string[], instancePath: string) => {
  return {
    keyword: "valid_tuple",
    message: `invalid type '${user}'. Valid types are [${types}]`,
    instancePath,
  };
};

const relationMustExistOnType = (relation: string, type: string, instancePath: string) => {
  return {
    keyword: "valid_tuple",
    message: `relation '${relation}' is not a relation on type '${type}'.`,
    instancePath,
  };
};

const userNotTypeRestriction = (user: string, tuple: TupleKey, instancePath: string) => {
  return {
    keyword: "valid_tuple",
    message: `'${user}' is not a type restriction on relation '${tuple.relation}' of type '${
      tuple.object.split(":")[0]
    }'.`,
    instancePath: instancePath + "/user",
  };
};

const conditionDoesntExist = (tuple: TupleKey, instancePath: string) => {
  return {
    keyword: "valid_tuple",
    message: `condition '${tuple.condition?.name}' is not defined.`,
    instancePath: instancePath + "/condition/name",
  };
};

const notAParameter = (param: string, tuple: TupleKey, instancePath: string) => {
  return {
    keyword: "valid_tuple",
    message: `'${param}' is not a parameter on condition '${tuple.condition?.name}'.`,
    instancePath: instancePath + `/condition/context/${param}`,
  };
};

// Format enforcement

function formatUser(user: string): boolean {
  if (!user.match(new RegExp(`^${identifier}:(\\*|${identifier}(#${identifier})?)$`)) || user.length > 512) {
    return false;
  }
  return true;
}

function formatRelation(relation: string): boolean {
  if (!relation.match(new RegExp(`^${identifier}$`)) || relation.length > 50) {
    return false;
  }
  return true;
}

function formatObject(object: string): boolean {
  if (!object.match(new RegExp(`^${identifier}:${identifier}$`)) || object.length > 256) {
    return false;
  }
  return true;
}

function formatCondition(condition: string): boolean {
  if (!condition.match(new RegExp(`^${identifier}$`)) || condition.length > 50) {
    return false;
  }
  return true;
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
  conditions: { [key: string]: Condition } | undefined,
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
  conditions: { [key: string]: Condition } | undefined,
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
  conditions: { [key: string]: Condition },
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

export function YamlStoreValidator(): ValidateFunction {
  // YAML validation
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
    .addKeyword({
      keyword: "valid_tuple",
      type: "object",
      schema: false,
      errors: true,
      validate: validateTuple,
    })
    .compile(OPENFGA_YAML_SCHEMA);
}

const OPENFGA_YAML_SCHEMA: Schema = {
  type: "object",
  required: ["tests"],
  additionalProperties: false,
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
        valid_tuple: true,
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
