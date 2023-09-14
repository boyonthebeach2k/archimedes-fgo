/** Tracks timeouts */
const timeoutIDs: NodeJS.Timeout[] = [],
    intervalIDs: NodeJS.Timer[] = [];

/**
 * Wrapper around setTimeout to keep track of queued functions. Calls `setTimeout` internally,
 * but keeps track of the returned `timeoutID` for easy clearing afterwards. */
function scheduleTimeout(callback: CallableFunction, milliseconds: number) {
    let timeoutID: NodeJS.Timeout;

    const wrappedCallback = () => {
        callback();

        /** Cleanup - remove the timeoutID from `timeoutIDs` */
        const timeoutIndex = timeoutIDs.indexOf(timeoutID);

        if (timeoutIndex > -1) {
            // Only splice timeoutIDs when item is found
            timeoutIDs.splice(timeoutIndex, 1); // Remove only the one ID
        }
    };

    timeoutIDs.push(setTimeout(wrappedCallback, milliseconds));
}

/**
 * Clears all queued timeouts
 */
function clearTimeouts() {
    for (const timeoutID of timeoutIDs) {
        clearTimeout(timeoutID); //  Passing an invalid ID to `clearTimeout()` silently does nothing; no exception is thrown.
    }
}

/**
 * Wrapper around setInterval to keep track of queued functions. Calls `setInterval` internally,
 * but keeps track of the returned `intervalID` for easy clearing afterwards. */
function scheduleInterval(callback: CallableFunction, milliseconds: number) {
    intervalIDs.push(setInterval(() => callback(), milliseconds));
}

/**
 * Clears all queued intervals
 */
function clearIntervals() {
    for (const intervalID of intervalIDs) {
        clearInterval(intervalID); //  Passing an invalid ID to `clearInterval()` silently does nothing; no exception is thrown.
    }
}

export { scheduleTimeout, clearTimeouts, scheduleInterval, clearIntervals };
