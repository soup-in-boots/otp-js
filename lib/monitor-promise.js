function MonitorPromise(OnSchedule, OnFinish) {
    OnFinish = OnFinish || function() {};
    OnSchedule = OnSchedule || function() {};
    class MonitoredPromise extends Promise {
        constructor(op) {
            OnSchedule();
            var resolved = false;
            var monitoredOp = function(resolve, reject) {
                var monitoredResolve = function() {
                    if (resolved) return;
                    resolved = true;

                    resolve(...arguments);
                    OnFinish();
                },
                monitoredReject = function() {
                    if (resolved) return;
                    resolved = true;

                    reject(...arguments);
                    OnFinish();
                };

                op(monitoredResolve, monitoredReject);
            };
            super(monitoredOp);
        }
    }

    return MonitoredPromise;
}

module.exports = MonitorPromise;
