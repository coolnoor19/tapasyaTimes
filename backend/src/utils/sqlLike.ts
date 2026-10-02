// Treat search text literally: "%" and "_" are wildcards in LIKE, so escape them.
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)
