export const OPENFGA_YAML_SCHEMA = {
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
            description: "the user",
          },
          relation: {
            type: "string",
            description: "the relation",
          },
          object: {
            type: "string",
            description: "the object",
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
                  description: "the user",
                },
                relation: {
                  type: "string",
                  description: "the relation",
                },
                object: {
                  type: "string",
                  description: "the object",
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
          check: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["user", "object", "assertions"],
              properties: {
                user: {
                  type: "string",
                  description: "the user",
                },
                object: {
                  type: "string",
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
                  description: "the user",
                },
                relation: {
                  type: "string",
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
