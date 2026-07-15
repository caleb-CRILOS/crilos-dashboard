// mammoth ships no TypeScript types of its own and there's no @types/mammoth
// package -- minimal shim covering just the one function this codebase uses.
declare module "mammoth" {
  export interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }

  export function extractRawText(input: { buffer: Buffer }): Promise<ExtractRawTextResult>;
}
