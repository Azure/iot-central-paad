export * from './CustomLogger';
export { default as EventLogger } from './EventLogger';
export async function TimeOut(seconds: number) {
    return new Promise(r => setTimeout(r, seconds));
}
