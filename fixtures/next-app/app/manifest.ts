import { site } from '../lib/site'

// The whole point of the fixture's manifest route: Next's metadata route loader
// rejects a non-function default export, and no unit test can reach that guard.
export default site.manifest
