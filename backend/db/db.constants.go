package db

const UniqueConstraintViolationCode = "23505"
const ForeignKeyViolationCode = "23503"
const NotNullViolationCode = "23502"
const CheckViolationCode = "23514"
const InvalidTextRepresentationCode = "22P02" // e.g. invalid UUID or enum value
const ConnectionFailureCode = "08006"
const TooManyConnectionsCode = "53300"
const ValueTooLongCode = "22001" // e.g. when trying to insert a string that exceeds the defined length
const MaxProjectNameLength = 255
const MaxSkillNameLength = 255
const MaxSkillDescriptionLength = 255
