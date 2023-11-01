export const OPENFGA_YAML_SCHEMA = {
  type: "object",
  required: ["tests"],
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      description: "The store name",
    },
    model_file: {
      type: "string",
      description: "The Authorization Model",
    },
    model: {
      type: "string",
      description: "The Authorization Model",
    },
    tuples_file: {
      type: "string",
    },
    tuples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["user", "relation", "object"],
        properties: {
          user: {
            type: "string",
            description: "The user",
          },
          relation: {
            type: "string",
            description: "The relation",
          },
          object: {
            type: "string",
            description: "The object",
          },
          condition: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: {
              name: {
                type: "string",
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
        required: ["name", "check", "list_objects"],
        properties: {
          name: {
            type: "string",
            description: "The test name",
          },
          description: {
            type: "string",
            description: "The test description",
          },
          tuples_file: {
            type: "string",
          },
          tuples: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["user", "relation", "object"],
              properties: {
                user: {
                  type: "string",
                  description: "The user",
                },
                relation: {
                  type: "string",
                  description: "The relation",
                },
                object: {
                  type: "string",
                  description: "The object",
                },
                context: {
                  type: "object",
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
                  description: "The user",
                },
                object: {
                  type: "string",
                  description: "The object",
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
                  description: "The user",
                },
                relation: {
                  type: "string",
                  description: "The relation",
                },
                type: {
                  type: "string",
                  description: "The object type",
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
