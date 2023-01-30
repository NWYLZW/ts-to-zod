import { generate } from "./generate";

describe("generate", () => {
  describe("simple case", () => {
    const sourceText = `
      export type Name = "superman" | "clark kent" | "kal-l";

      // Note that the Superman is declared after
      export type BadassSuperman = Omit<Superman, "underKryptonite">;

      export interface Superman {
        name: Name;
        age: number;
        underKryptonite?: boolean;
        /**
         * @format email
         **/
        email: string;
      }

      const fly = () => console.log("I can fly!");
      `;

    const { getZodSchemasFile, getIntegrationTestFile, errors } = generate({
      sourceText,
    });

    it("should generate the zod schemas", () => {
      expect(getZodSchemasFile("./hero")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        export const nameSchema = z.union([z.literal(\\"superman\\"), z.literal(\\"clark kent\\"), z.literal(\\"kal-l\\")]);

        export const supermanSchema = z.object({
            name: nameSchema,
            age: z.number(),
            underKryptonite: z.boolean().optional(),
            email: z.string().email()
        });

        export const badassSupermanSchema = supermanSchema.omit({ \\"underKryptonite\\": true });
        "
      `);
    });

    it("should generate the integration tests", () => {
      expect(getIntegrationTestFile("./hero", "hero.zod"))
        .toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        import * as spec from \\"./hero\\";
        import * as generated from \\"hero.zod\\";

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function expectType<T>(_: T) {
          /* noop */
        }

        export type nameSchemaInferredType = z.infer<typeof generated.nameSchema>;

        export type supermanSchemaInferredType = z.infer<typeof generated.supermanSchema>;

        export type badassSupermanSchemaInferredType = z.infer<typeof generated.badassSupermanSchema>;
        expectType<spec.Name>({} as nameSchemaInferredType)
        expectType<nameSchemaInferredType>({} as spec.Name)
        expectType<spec.Superman>({} as supermanSchemaInferredType)
        expectType<supermanSchemaInferredType>({} as spec.Superman)
        expectType<spec.BadassSuperman>({} as badassSupermanSchemaInferredType)
        expectType<badassSupermanSchemaInferredType>({} as spec.BadassSuperman)
        "
      `);
    });
    it("should not have any errors", () => {
      expect(errors.length).toBe(0);
    });
  });

  describe("with enums", () => {
    const sourceText = `
      export enum Superhero {
        Superman = "superman"
        ClarkKent = "clark-kent"
      };

      export type FavoriteSuperhero = {
        superhero: Superhero.Superman
      };
      `;

    const { getZodSchemasFile, getIntegrationTestFile, errors } = generate({
      sourceText,
    });

    it("should generate the zod schemas", () => {
      expect(getZodSchemasFile("./superhero")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";
        import { Superhero } from \\"./superhero\\";

        export const superheroSchema = z.nativeEnum(Superhero);

        export const favoriteSuperheroSchema = z.object({
            superhero: z.literal(Superhero.Superman)
        });
        "
      `);
    });

    it("should generate the integration tests", () => {
      expect(getIntegrationTestFile("./superhero", "superhero.zod"))
        .toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        import * as spec from \\"./superhero\\";
        import * as generated from \\"superhero.zod\\";

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function expectType<T>(_: T) {
          /* noop */
        }

        export type superheroSchemaInferredType = z.infer<typeof generated.superheroSchema>;

        export type favoriteSuperheroSchemaInferredType = z.infer<typeof generated.favoriteSuperheroSchema>;
        expectType<spec.Superhero>({} as superheroSchemaInferredType)
        expectType<superheroSchemaInferredType>({} as spec.Superhero)
        expectType<spec.FavoriteSuperhero>({} as favoriteSuperheroSchemaInferredType)
        expectType<favoriteSuperheroSchemaInferredType>({} as spec.FavoriteSuperhero)
        "
      `);
    });

    it("should not have any errors", () => {
      expect(errors.length).toBe(0);
    });
  });

  describe("with circular references", () => {
    const sourceText = `
      export interface Villain {
        name: string;
        powers: string[];
        friends: Villain[];
      }

      export interface EvilPlan {
        owner: Villain;
        description: string;
        details: EvilPlanDetails;
      }

      export interface EvilPlanDetails {
        parent: EvilPlan; // <- Unsolvable circular reference
        steps: string[];
      }
      `;

    const { getZodSchemasFile, getIntegrationTestFile, errors } = generate({
      sourceText,
      maxRun: 3,
    });

    it("should generate the zod schemas", () => {
      expect(getZodSchemasFile("./villain")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";
        import { Villain } from \\"./villain\\";

        export const villainSchema: z.ZodSchema<Villain> = z.lazy(() => z.object({
            name: z.string(),
            powers: z.array(z.string()),
            friends: z.array(villainSchema)
        }));
        "
      `);
    });

    it("should generate the integration tests", () => {
      expect(getIntegrationTestFile("./villain", "villain.zod"))
        .toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        import * as spec from \\"./villain\\";
        import * as generated from \\"villain.zod\\";

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function expectType<T>(_: T) {
          /* noop */
        }

        export type villainSchemaInferredType = z.infer<typeof generated.villainSchema>;
        expectType<spec.Villain>({} as villainSchemaInferredType)
        expectType<villainSchemaInferredType>({} as spec.Villain)
        "
      `);
    });

    it("should have some errors", () => {
      expect(errors).toMatchInlineSnapshot(`
        Array [
          "Some schemas can't be generated due to circular dependencies:
        evilPlanSchema
        evilPlanDetailsSchema",
        ]
      `);
    });
  });

  describe("with options", () => {
    const sourceText = `export interface Superman {
      /**
       * Name of superman
       */
      name: string;
    }

    export interface Villain {
      name: string;
      didKillSuperman: true;
    }
    `;

    const { getZodSchemasFile } = generate({
      sourceText,
      nameFilter: (id) => id === "Superman",
      getSchemaName: (id) => id.toLowerCase(),
      keepComments: true,
    });

    it("should generate superman schema", () => {
      expect(getZodSchemasFile("./hero")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        export const superman = z.object({
            /**
             * Name of superman
             */
            name: z.string()
        });
        "
      `);
    });
  });

  describe("inheritance and reference type search", () => {
    const sourceText = `
    export type Name = "superman" | "clark kent" | "kal-l";
    export interface Superman {
      name: Name;
    }`;

    const { getZodSchemasFile } = generate({
      sourceText,
      nameFilter: (id) => id === "Superman",
      getSchemaName: (id) => id.toLowerCase(),
      keepComments: true,
    });

    it("should generate superman schema", () => {
      expect(getZodSchemasFile("./hero")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        export const name = z.union([z.literal(\\"superman\\"), z.literal(\\"clark kent\\"), z.literal(\\"kal-l\\")]);

        export const superman = z.object({
            name: name
        });
        "
      `);
    });
  });

  describe("with jsdocTags filter", () => {
    it("should generate only types with @zod", () => {
      const sourceText = `
      /**
       * @zod
       **/
      export type Name = "superman" | "clark kent" | "kal-l";

      /**
       * @nop
       */
      export type BadassSuperman = Omit<Superman, "underKryptonite">;

      /**
       * Only this interface should be generated
       *
       * @zod
       */
      export interface Superman {
        name: Name;
        age: number;
        underKryptonite?: boolean;
        /**
         * @format email
         **/
        email: string;
      }
      `;

      const { getZodSchemasFile } = generate({
        sourceText,
        jsDocTagFilter: (tags) => tags.map((tag) => tag.name).includes("zod"),
      });

      expect(getZodSchemasFile("./source")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        export const nameSchema = z.union([z.literal(\\"superman\\"), z.literal(\\"clark kent\\"), z.literal(\\"kal-l\\")]);

        export const supermanSchema = z.object({
            name: nameSchema,
            age: z.number(),
            underKryptonite: z.boolean().optional(),
            email: z.string().email()
        });
        "
      `);
    });
  });

  describe("with non-exported types", () => {
    it("should generate tests for exported schemas", () => {
      const sourceText = `
      export type Name = "superman" | "clark kent" | "kal-l";

      // Note that the Superman is declared after
      export type BadassSuperman = Omit<Superman, "underKryptonite">;

      interface Superman {
        name: Name;
        age: number;
        underKryptonite?: boolean;
        /**
         * @format email
         **/
        email: string;
      }
      `;

      const { getIntegrationTestFile } = generate({
        sourceText,
      });

      expect(getIntegrationTestFile("./source", "./source.zod"))
        .toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        import * as spec from \\"./source\\";
        import * as generated from \\"./source.zod\\";

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function expectType<T>(_: T) {
          /* noop */
        }

        export type nameSchemaInferredType = z.infer<typeof generated.nameSchema>;

        export type badassSupermanSchemaInferredType = z.infer<typeof generated.badassSupermanSchema>;
        expectType<spec.Name>({} as nameSchemaInferredType)
        expectType<nameSchemaInferredType>({} as spec.Name)
        expectType<spec.BadassSuperman>({} as badassSupermanSchemaInferredType)
        expectType<badassSupermanSchemaInferredType>({} as spec.BadassSuperman)
        "
      `);
    });
  });

  describe("with namespace", () => {
    const sourceText = `
      export namespace Metropolis {
        export type Name = "superman" | "clark kent" | "kal-l";

        // Note that the Superman is declared after
        export type BadassSuperman = Omit<Superman, "underKryptonite">;

        export interface Superman {
          name: Name;
          age: number;
          underKryptonite?: boolean;
          /**
           * @format email
           **/
          email: string;
        }

        const fly = () => console.log("I can fly!");
      }
      `;

    const { getZodSchemasFile, getIntegrationTestFile, errors } = generate({
      sourceText,
    });

    it("should generate the zod schemas", () => {
      expect(getZodSchemasFile("./hero")).toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        export const metropolisNameSchema = z.union([z.literal(\\"superman\\"), z.literal(\\"clark kent\\"), z.literal(\\"kal-l\\")]);

        export const metropolisSupermanSchema = z.object({
            name: metropolisNameSchema,
            age: z.number(),
            underKryptonite: z.boolean().optional(),
            email: z.string().email()
        });

        export const metropolisBadassSupermanSchema = metropolisSupermanSchema.omit({ \\"underKryptonite\\": true });
        "
      `);
    });

    it("should generate the integration tests", () => {
      expect(getIntegrationTestFile("./hero", "hero.zod"))
        .toMatchInlineSnapshot(`
        "// Generated by ts-to-zod
        import { z } from \\"zod\\";

        import * as spec from \\"./hero\\";
        import * as generated from \\"hero.zod\\";

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function expectType<T>(_: T) {
          /* noop */
        }

        export type metropolisNameSchemaInferredType = z.infer<typeof generated.metropolisNameSchema>;

        export type metropolisSupermanSchemaInferredType = z.infer<typeof generated.metropolisSupermanSchema>;

        export type metropolisBadassSupermanSchemaInferredType = z.infer<typeof generated.metropolisBadassSupermanSchema>;
        expectType<spec.MetropolisName>({} as metropolisNameSchemaInferredType)
        expectType<metropolisNameSchemaInferredType>({} as spec.MetropolisName)
        expectType<spec.MetropolisSuperman>({} as metropolisSupermanSchemaInferredType)
        expectType<metropolisSupermanSchemaInferredType>({} as spec.MetropolisSuperman)
        expectType<spec.MetropolisBadassSuperman>({} as metropolisBadassSupermanSchemaInferredType)
        expectType<metropolisBadassSupermanSchemaInferredType>({} as spec.MetropolisBadassSuperman)
        "
      `);
    });
    it("should not have any errors", () => {
      expect(errors).toEqual([]);
    });
  });
});
