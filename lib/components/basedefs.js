const { SourceFile } = require('../file')

// eslint-disable-next-line no-template-curly-in-string
const dateRegex = '`${number}${number}${number}${number}-${number}${number}-${number}${number}`'
// eslint-disable-next-line no-template-curly-in-string
const timeRegex = '`${number}${number}:${number}${number}:${number}${number}`'

/**
 * Base definitions used throughout the typing process,
 * such as Associations and Compositions.
 * @type {SourceFile}
 */
const baseDefinitions = new SourceFile('_')
// FIXME: this should be a library someday
baseDefinitions.addPreamble(`
export type Constructable<T = any> = { new (...args: any[]): T; }; 
export type ArrayConstructable<T> = { new (...args: any[]): T[] };
export type DraftEntity<T> = T & {
    IsActiveEntity?: boolean | null
    HasDraftEntity?: boolean | null
    HasActiveEntity?: boolean | null
    DraftAdministrativeData_DraftUUID?: string | null   
}
export type InlineDeclaration<T, P extends string> = {
    [K in keyof T as K extends string ? \`\${P}_\${K}\` : never]: T[K]
}
export function asSingular<T>(proto: T) {
    return {
        is_singular: true,
        __proto__: proto,
    };
}
export type singular = {
    is_singular: boolean;
};

export type withName = {
    name: string;
};

export namespace Association {
    export type to <T> = T;
    export namespace to {
        export type many <T extends readonly any[]> = T;
    }
}

export namespace Composition {
    export type of <T> = T;
    export namespace of {
        export type many <T extends readonly any[]> = T;
    }
}

export class Entity {
    static data<T extends Entity> (this:T, _input:Object) : T {
        return {} as T // mock
    }
}

export type EntitySet<T> = T[] & {
    data (input:object[]) : T[]
    data (input:object) : T
};

export type DeepRequired<T> = { 
    [K in keyof T]: DeepRequired<T[K]>
} & Exclude<Required<T>, null>;


/**
 * Dates and timestamps are strings during runtime, so cds-typer represents them as such.
 */
export type CdsDate = ${dateRegex};
/**
 * @see {@link CdsDate}
 */
export type CdsDateTime = string;
/**
 * @see {@link CdsDate}
 */
export type CdsTime = ${timeRegex};
/**
 * @see {@link CdsDate}
 */
export type CdsTimestamp = string;
`)

module.exports = { baseDefinitions }