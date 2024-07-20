const annotation = '@odata.draft.enabled'

/**
 * FIXME: this is pretty handwavey: we are looking for view-entities,
 * i.e. ones that have a query, but are not a cds level projection.
 * Those are still not expanded and we have to retrieve their definition
 * with all properties from the inferred model.
 * @param {any} entity - the entity
 */
const isView = entity => entity.query && !entity.projection

const isProjection = entity => entity.projection

/**
 * @param {any} entity - the entity
 * @see isView
 * Unresolved entities have to be looked up from inferred csn.
 */
const isUnresolved = entity => entity._unresolved === true

const isCsnAny = entity => entity?.constructor?.name === 'any'

const isDraftEnabled = entity => entity['@odata.draft.enabled'] === true

const isType = entity => entity?.kind === 'type'

const isEntity = entity => entity?.kind === 'entity'

/**
 * Attempts to retrieve the max cardinality of a CSN for an entity.
 * @param {EntityCSN} element - csn of entity to retrieve cardinality for
 * @returns {number} max cardinality of the element.
 * If no cardinality is attached to the element, cardinality is 1.
 * If it is set to '*', result is Infinity.
 */
const getMaxCardinality = element => {
    const cardinality = element?.cardinality?.max ?? 1
    return cardinality === '*' ? Infinity : parseInt(cardinality)
}

const getViewTarget = entity => entity.query?.SELECT?.from?.ref?.[0]

const getProjectionTarget = entity => entity.projection?.from?.ref?.[0]

/**
 * Determines the correct draft enabled state by using the csn for sql via
 * cds.compile.for.sql(<inferred-csn>) which will contain all draft entities that will later
 * be deployed to the database.
 * 
 * NOTE: The sql model also contains the generated .texts entities (from localized properties)
 */
function determineDraftEntities(csn) {
    csn.draftEnabled ??= []
    Object.entries(csn.sql.definitions)
        .filter(([fqn]) => fqn.endsWith('.drafts'))
        .forEach(([draftFqn]) => {
            csn.draftEnabled.push(draftFqn.substring(0, draftFqn.length - 7))
        })
}

/**
 * Propagates keys elements through the CSN. This includes
 *
 * (a) keys that are explicitly declared as key in an entity
 * (b) keys from aspects the entity extends
 *
 * This explicit propagation is required to add foreign key relations
 * to referring entities.
 * @param {any} csn - the entity
 * @example
 * ```cds
 * entity A: cuid { key name: String; }
 * entity B { ref: Association to one A }
 * ```
 * must yield
 * ```ts
 * class A {
 *   ID: UUID // inherited from cuid
 *   name: String;
 * }
 * class B {
 *   ref: Association.to<A>
 *   ref_ID: UUID
 *   ref_name: String;
 * }
 * ```
 */
function propagateForeignKeys(csn) {
    for (const element of Object.values(csn.definitions)) {
        Object.defineProperty(element, 'keys', {
            get: function () {
                // cached access to all immediately defined _and_ inherited keys.
                // They need to be explicitly accessible in subclasses to generate
                // foreign key fields from Associations/ Compositions.
                if (!Object.hasOwn(this, '__keys')) {
                    const ownKeys = Object.entries(this.elements ?? {}).filter(([,el]) => el.key === true)
                    const inheritedKeys = this.includes?.flatMap(parent => Object.entries(csn.definitions[parent].keys)) ?? []
                    // not sure why, but .associations contains both Associations, as well as Compositions in CSN.
                    // (.compositions contains only Compositions, if any)
                    const remoteKeys = Object.entries(this.associations ?? {})
                        .filter(([,{key}]) => key)  // only follow associations that are keys, that way we avoid cycles
                        .flatMap(([kname, key]) => Object.entries(csn.definitions[key.target].keys)
                            .map(([ckname, ckey]) => [`${kname}_${ckname}`, ckey]))

                    this.__keys = Object.fromEntries(ownKeys
                        .concat(inheritedKeys)
                        .concat(remoteKeys)
                        .filter(([,ckey]) => !ckey.target)  // discard keys that are Associations. Those are already part of .elements
                    )
                }
                return this.__keys
            }
        })
    }
}

/**
 *
 * @param {any} csn - complete csn
 */
function amendCSN(csn) {
    determineDraftEntities(csn)
    propagateForeignKeys(csn.xtended)
}


const getProjectionAliases = entity => {
    const aliases = {}
    let all = false
    for (const col of entity?.projection?.columns ?? []) {
        if (col === '*') {
            all = true
        } else if (col.ref) {
            (aliases[col.ref[0]] ??= []).push(col.as ?? col.ref[0])
        } else {
            // TODO: error, casting seems to miss ref...
        }
    }
    return { aliases, all }
}

module.exports = {
    amendCSN,
    isView,
    isProjection,
    isDraftEnabled,
    isEntity,
    isUnresolved,
    isType,
    getMaxCardinality,
    getProjectionTarget,
    getProjectionAliases,
    getViewTarget,
    propagateForeignKeys,
    isCsnAny
}
