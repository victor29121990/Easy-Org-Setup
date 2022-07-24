import fetchScheduledApexJobs from '@salesforce/apex/OrgRefresherHelper.fetchScheduledApexJobs';
import fetchOutboundWorkflows from '@salesforce/apex/OrgRefresherHelper.fetchOutboundWorkflows';
import isOutboundWorkflow from '@salesforce/apex/OrgRefresherHelper.isOutboundWorkflow';

export function invokeFetchScheduledApexJobs(resolve, reject) {
    fetchScheduledApexJobs()
        .then(result => {
            resolve(result);
        })
        .catch(error => {
            reject(error);
            this.DSAJLoading = false;
            this.errorDSAJ = error;
            this.DASLoading = false;
            this.errorDAS = error;
            //showErrorToast(this, error);
        });
}

export function invokeFetchAndFilterOutboundWorkflows(resolve, reject) {
    fetchOutboundWorkflows()
        .then(result => {
            let resultObj = JSON.parse(result);
            if (resultObj.isSuccess) {
                let allWorkflowRules = [];
                resultObj.returnValue.workflows.forEach((item, index) => {
                    allWorkflowRules.push(item);
                });
                setTimeout((allWorkflowRules, resolve, reject) => {
                    filterWorkflows(allWorkflowRules, resolve, reject);
                }, 10);
            }
            else {
                reject(resultObj.errorMsgs);
            }
        })
        .catch(error => {
            reject(error);
        });
}

async function filterWorkflows(allWorkflowRules, resolve, reject) {
    let warnings = [];
    let serial = -1;
    let filteredWorkflowRules = [];
    for (let i = 0; i < allWorkflowRules.length; i++) {
        try {
            let result = await isOutboundWorkflow({ "wfId": allWorkflowRules[i].Id });
            console.log(result);
            let resultObj = JSON.parse(result);
            if (resultObj.isSuccess) {

                let actions = resultObj.returnValue.workflow.Metadata.actions;
                let hasOutbound = false;
                actions.forEach((item) => {
                    if (item.type == "OutboundMessage") {
                        hasOutbound = true;
                    }
                });
                if (hasOutbound) {
                    filteredWorkflowRules = [...filteredWorkflowRules, resultObj];
                }
            }
            else {
                warnings.push(resultObj.errorMsgs.join(','));
            }
        }
        catch (err) {
            console.log('error', err);
            warnings.push(err);
        }
    }
    resolve(filteredWorkflowRules, warnings);
}
