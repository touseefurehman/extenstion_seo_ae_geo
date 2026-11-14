import { extractSnapshot } from './extractor';

// The build wraps this bundle so the default export is the script's completion value,
// which chrome.scripting.executeScript returns to the background worker.
export default extractSnapshot();
