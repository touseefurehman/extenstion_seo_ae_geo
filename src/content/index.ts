import { extractSnapshot } from './extractor';

// The build wraps this bundle so the default export is the script's completion value. It is a
// Promise, which chrome.scripting.executeScript awaits before returning the snapshot.
export default extractSnapshot();
