import { api, LightningElement } from 'lwc';
import disableApexJobs from '@salesforce/apex/OrgRefresherHelper.disableApexJobs';
import { showErrorToast } from 'c/lwcUtility';
import { invokeFetchScheduledApexJobs } from 'c/dataFetcher';

export default class DisableScheduledApexJobs extends LightningElement {

    @api initiateData(data) {
        this.prepareData(data);
    }
    @api initiateError(error) {
        this.handleError(error);
    }
    _allApexJobs;

    sectionOpen = true;
    loading = true;
    get headerText() {
        return 'Disable Scheduled Apex Jobs';
    }
    get disableDSAJ() {
        let selectedItems = [];
        if (this._allApexJobs) {
            selectedItems = this._allApexJobs.filter(item => {
                return item.checked;
            });
        }
        return selectedItems.length == 0;
    }
    //DSAJ FUNCTIONS - START
    disableApexJobs() {

        let selectedItems = this._allApexJobs.filter(item => {
            return item.checked;
        });
        console.log('selectedItems', selectedItems);
        let selectedCronIds = selectedItems.map(item => {
            return item.Id;
        });
        if (selectedItems) {
            this.loading = true;
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
                                this._allApexJobs = this._allApexJobs.map(item => {
                                    if (item.Id == key) {
                                        item.status = value.isSuccess ? 'done' : 'failed';
                                        item.msg = value.isSuccess ? '' : value.errorMsg;
                                    }
                                    return item;
                                });
                            }
                        }
                        this.loading = false;
                    }
                    else {
                        this.handleError(resultObj.errorMsgs);
                    }
                })
                .catch(error => {
                    this.handleError(error);
                });
        }
    }
    //DSAJ FUNCTIONS - END

    selectAllToggle(e) {
        this._allApexJobs = this._allApexJobs.map(item => {
            item.checked = e.target.checked;
            return item;
        });
    }
    handleSelectionChange(e) {
        let index = e.target.getAttribute('data-id');
        this._allApexJobs[index].checked = e.target.checked;
        this._allApexJobs = [...this._allApexJobs];
        console.log('all', this._allApexJobs);
    }
    cancel() {
        this.sectionOpen = false;
        let evt = new CustomEvent('cancel');
        this.dispatchEvent(evt);
    }
    
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
            this.allApexJobs = [];
            console.log(resultObj.returnValue['Scheduled Apex']);
            if (resultObj.returnValue['Scheduled Apex']) {
                console.log('jobs exists');
                this._allApexJobs = [];
                resultObj.returnValue['Scheduled Apex'].forEach((item, index) => {
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
                    this._allApexJobs.push(item);
                });
                console.log(this._allApexJobs);
                this.loading = false;
            }
            else {
                this.handleError("No Scheduled Apex Jobs found!");
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
}
