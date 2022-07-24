import { LightningElement, api } from 'lwc';
import disableApexJobs from '@salesforce/apex/OrgRefresherHelper.disableApexJobs';
import { showErrorToast } from 'c/lwcUtility';
import { invokeFetchScheduledApexJobs } from 'c/dataFetcher';

export default class DisableAnalyticalSnapshots extends LightningElement {
    @api initiateData(data) {
        this.prepareData(data);
    }
    @api initiateError(error) {
        this.handleError(error);
    }
    _allReportingJobs;

    get disableDAS() {
        let selectedItems = [];
        if (this._allReportingJobs) {
            selectedItems = this._allReportingJobs.filter(item => {
                return item.checked;
            });
        }
        return selectedItems.length == 0;
    }
    sectionOpen = true;
    loading = true;
    get headerText() {
        return 'Disable Analytical/Reporting Snapshots';
    }
    //DAS FUNCTIONS - START
    disableReportingJobs() {
        let selectedItems = this._allReportingJobs.filter(item => {
            return item.checked;
        });
        console.log('selectedItems', selectedItems);
        let selectedCronIds = selectedItems.map(item => {
            return item.Id;
        })
        if (selectedItems) {
            disableApexJobs({ "cronIdsAsString": JSON.stringify(selectedCronIds) })
                .then(result => {
                    console.log(result);
                    //"{\"successMsg\":null,\"returnValue\":{\"08e2i00000BNxwpAAD\":{\"isSuccess\":true}},\"isSuccess\":true,\"errorMsgs\":null}"
                    let resultObj = JSON.parse(result);
                    console.log(resultObj);
                    if (resultObj.isSuccess) {
                        if (resultObj.returnValue) {
                            for (const [key, value] of Object.entries(resultObj.returnValue)) {
                                console.log(key, value);
                                this._allReportingJobs = this._allReportingJobs.map(item => {
                                    if (item.Id == key) {
                                        item.status = value.isSuccess ? 'done' : 'failed';
                                        item.msg = value.isSuccess ? '' : value.errorMsg;
                                    }
                                    return item;
                                });
                            }
                        }
                    }
                    else {
                        this.handleError(resultObj.errorMsgs);
                    }
                })
                .catch(error => {
                    console.log(JSON.stringify(error));
                    this.handleError(this, error);
                });
        }
    }
    //DAS FUNCTIONS - END

    refresh() {
        this.loading = true;
        let promise = new Promise((resolve, reject) => {
            invokeFetchScheduledApexJobs(resolve, reject);
        });
        promise.then((data) => {
            this.prepareData(data);
        });
        promise.catch((error) => {
            this.handleError(error);
        });
    }

    prepareData(result) {
        let resultObj = JSON.parse(result);
        console.log('outside', resultObj);
        if (resultObj.isSuccess) {
            this._allReportingJobs = [];
            if (resultObj.returnValue['Reporting Snapshot']) {
                console.log('jobs exists');
                resultObj.returnValue['Reporting Snapshot'].forEach((item, index) => {
                    item.NextFireTime = new Date(item.NextFireTime);
                    item = { ...item, ...{ 'index': index } };
                    item = { ...item, ...{ 'status': 'init' } };
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
                    this._allReportingJobs.push(item);
                });
                console.log(this._allReportingJobs);
                this.loading = false;
            }
            else {
                this.loading = false;
                this.handleError("No Scheduled Reporting Snapshots found!");
            }
        }
        else {
            this.loading = false;
            this.handleError(resultObj.errorMsgs);
        }
    }
    handleError(error) {
        console.log('error', error);
        this.loading = false;
        if (this.sectionOpen) {
            showErrorToast(this, error);
        }
    }
    selectAllToggle(e) {
        this._allReportingJobs = this._allReportingJobs.map(item => {
            item.checked = e.target.checked;
            return item;
        });
    }
    handleSelectionChange(e) {
        let index = e.target.getAttribute('data-id');
        this._allReportingJobs[index].checked = e.target.checked;
        this._allReportingJobs = [...this._allReportingJobs];
        console.log('all', this._allReportingJobs);
    }
    cancel() {
        this.sectionOpen = false;
        let evt = new CustomEvent('cancel');
        this.dispatchEvent(evt);
    }
}
