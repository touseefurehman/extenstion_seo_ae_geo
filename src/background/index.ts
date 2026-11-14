import { analyzeTab, chromeDeps } from './analyze';
import type { AnalyzeRequest } from '../types/messages';

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const request = message as Partial<AnalyzeRequest> | null;
  if (request?.type !== 'nexusrank:analyze' || typeof request.tabId !== 'number') {
    return false;
  }
  analyzeTab(request.tabId, chromeDeps).then(sendResponse);
  return true; // keep the channel open for the async response
});
