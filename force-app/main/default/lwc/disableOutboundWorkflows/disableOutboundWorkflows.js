import { LightningElement, api } from 'lwc';
import { showErrorToast } from 'c/lwcUtility';
import { invokeFetchAndFilterOutboundWorkflows } from 'c/dataFetcher';

export default class DisableOutboundWorkflows extends LightningElement {

    @api initiateData(data) {
        this.prepareData(data);
    }
    @api initiateError(error) {
        this.handleError(error);
    }
    @api initiateWarning(warnings) {
        this.handleWarning(warnings);
    }
    _filteredWorkflowRules;

    get disableDeactivateWorkflows() {
        let selectedItems = [];
        if (this._filteredWorkflowRules) {
            selectedItems = this._filteredWorkflowRules.filter(item => {
                return item.checked;
            });
        }
        return selectedItems.length == 0;
    }
    sectionOpen = true;
    loading = true;
    get headerText() {
        return 'Disable Outbound Workflows';
    }
    deactivateWorkflows() {
        console.log(this.filteredWorkflowRules);
        this.wfChainingIndex = -1;
        //purposefully slow to track each update
        this.workflowsSelected = this.filteredWorkflowRules.filter(item => {
            return item.checked;
        });
        console.log('workflowsSelected', this.workflowsSelected.length);
        this.showProgressDOWF = true;
        this.currentOperation = 'WORKFLOWDEACTIVATING';

        this.wfFilterTimer = setInterval(() => {
            this.wfChainingIndex++;
            this.deactivateOneWorkflow(this.wfChainingIndex);
        }, 500);
    }

    async deactivateOneWorkflow(index) {
        if (index == this.workflowsSelected.length) {
            clearInterval(this.wfFilterTimer);
            this.workflowUpdateLoading = false;
            this.wfChainingIndex = -1;
            return;
        }
        console.log('current', JSON.stringify(this.workflowsSelected[index]));
        let result = await deactivateWorkflows({ "workflowJSON": JSON.stringify(this.workflowsSelected[index].workflow), "wfId": this.workflowsSelected[index].Id });
        console.log('result', result);
        let resultObj = JSON.parse(result);
        if (resultObj.isSuccess) {
            let mainIndex = this.workflowsSelected[index].index;
            this.filteredWorkflowRules[mainIndex].status = 'done';
            this.filteredWorkflowRules[mainIndex].checked = false;
            this.filteredWorkflowRules[mainIndex].active = false;
            this.filteredWorkflowRules = [...this.filteredWorkflowRules];
        }
        else {
            let mainIndex = this.workflowsSelected[index].index;
            this.filteredWorkflowRules[mainIndex].status = 'failed';
            this.filteredWorkflowRules[mainIndex].msg = resultObj.errorMsgs.join(',');
            this.filteredWorkflowRules[mainIndex].checked = false;
            this.filteredWorkflowRules = [...this.filteredWorkflowRules];
        }
        if (++this.wfProcessed == this.workflowsSelected.length) {
            this.wfProcessed = 0;
            this.showProgressDOWF = false;
            this.currentOperation = null;
        }
    }
    refresh() {
        this.loading = true;
        let promise = new Promise((resolve, reject) => {
            invokeFetchAndFilterOutboundWorkflows(resolve, reject);
        });
        promise.then((data, warnings) => {
            this.prepareData(data);
            this.handleWarning(warnings);
        });
        promise.catch((error) => {
            this.handleError(error);
        });
    }
    prepareData(resultList) {
        this._filteredWorkflowRules = [];
        resultList.forEach((resultObj, index) => {
            let item = {};
            item = { ...item, ...{ 'active': resultObj.returnValue.workflow.Metadata.active } };
            item = { ...item, ...{ 'workflow': resultObj.returnValue.workflow } };
            item = { ...item, ...{ 'status': 'init' } };
            item = { ...item, ...{ 'index': index } };
            item = { ...item, ...{ 'checked': true } };
            item = { ...item, ...{ 'msg': '' } };
            Object.defineProperty(
                item,
                'isInit',
                {
                    get: function () {
                        return this.status == 'init';
                    }
                }
            );
            Object.defineProperty(
                item,
                'isDone',
                {
                    get: function () {
                        return this.status == 'done';
                    }
                }
            );
            Object.defineProperty(
                item,
                'isFailed',
                {
                    get: function () {
                        return this.status == 'failed';
                    }
                }
            );
            this._filteredWorkflowRules.push(item);
        });
        console.log('this._filteredWorkflowRules', this._filteredWorkflowRules);
    }
    handleError(error) {
        console.log('error', error);
        this.loading = false;
        if (this.sectionOpen) {
            showErrorToast(this, error);
        }
    }
    selectAllToggle(e) {
        this._filteredWorkflowRules = this._filteredWorkflowRules.map(item => {
            item.checked = e.target.checked;
            return item;
        });
    }
    handleSelectionChange(e) {
        let index = e.target.getAttribute('data-id');
        this._filteredWorkflowRules[index].checked = e.target.checked;
        this._filteredWorkflowRules = [...this._filteredWorkflowRules];
        console.log('all', this._filteredWorkflowRules);
    }
    cancel() {
        this.sectionOpen = false;
        let evt = new CustomEvent('cancel');
        this.dispatchEvent(evt);
    }
}
