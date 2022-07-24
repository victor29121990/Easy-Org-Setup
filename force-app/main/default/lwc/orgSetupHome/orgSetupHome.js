import { LightningElement, wire } from 'lwc';
import fetchOrgInformation from '@salesforce/apex/OrgRefresherHelper.fetchOrgInformation';

import deactivateWorkflows from '@salesforce/apex/OrgRefresherHelper.deactivateWorkflows';

import fetchScheduledApexJobs from '@salesforce/apex/OrgRefresherHelper.fetchScheduledApexJobs';

import fetchAllOutboundMsgs from '@salesforce/apex/OrgRefresherHelper.fetchAllOutboundMsgs';
import updateOutboundEndpoints from '@salesforce/apex/OrgRefresherHelper.updateOutboundEndpoints';
import fetchCustomSettingList from '@salesforce/apex/OrgRefresherHelper.fetchCustomSettingList';
import fetchCustomSettingMetadataAndData from '@salesforce/apex/OrgRefresherHelper.fetchCustomSettingMetadataAndData';
import updateCustomSettings from '@salesforce/apex/OrgRefresherHelper.updateCustomSettings';
import { showErrorToast, showErrorToastWithMsg } from 'c/lwcUtility';
import { invokeFetchScheduledApexJobs, invokeFetchAndFilterOutboundWorkflows } from 'c/dataFetcher';

const DSAJCompName = 'c-disable-scheduled-apex-jobs';
const DASCompName = 'c-disable-analytical-snapshots';
const DOWFCompName = 'c-disable-outbound-workflows';

function Record() {
    this.Id = '';
    this.data = [];
    this.checked = false;
    this.status == '';
}
function FieldDetail() {
    this.api = '';
    this.type = '';
    this.value = '';
}
Record.prototype = {
    get isInit() {
        return this.status == 'init';
    },
    get isDone() {
        return this.status == 'done';
    },
    get isFailed() {
        return this.status == 'failed';
    },
}
FieldDetail.prototype = {
    get isText() {
        return this.type == 'STRING';
    },
    get isTextArea() {
        return this.type == 'TEXTAREA';
    },
    get isNumber() {
        return this.type == 'DOUBLE' || this.type == 'CURRENCY';
    },
    get isCheckbox() {
        return this.type == 'BOOLEAN';
    },
    get isDate() {
        return this.type == 'DATE';
    },
    get isDatetime() {
        return this.type == 'DATETIME';
    }
}
export default class OrgSetupHome extends LightningElement {

    //welcome screen variables
    orgName;
    orgURL;
    name;
    orgType;
    isSandbox;
    environment;
    //DSAJ start
    errorDSAJ;
    DSAJData;
    //DSAJ end

    //DAS start
    errorDAS;
    DASData;
    //DAS end

    //DOWF start
    DOWFData;
    errorDOWF;
    DOWFWarnings;
    
    //DOWF end

    //UOWF start
    allOutboundMsgs = [];
    outboundsSelected = [];
    chainingIndex = -1;
    outboundProcessed = 0;
    intervalTimer;
    errorUOWF;
    get disableUpdateEndpoints() {
        let selectedItems = this.allOutboundMsgs.filter(item => {
            return item.checked;
        });
        return this.allOutboundMsgs.length == 0 || selectedItems.length == 0;
    }
    //UOWF end

    //OCS start
    customSettingOptions = [];
    selectedCS;
    fieldsApiToDetails = [];
    customSettingRecordList = [];



    get showAsTable() {
        return this.customSettingHeaders.length < 5;
    }
    get customSettingHeaders() {
        return this.fieldsApiToDetails.map(item => { return { 'api': item.api, 'label': item.Label } })
    }
    get recordsAsList() {
        let rows = this.customSettingRecordList.map(item => {
            let row = new Record();
            row.Id = item.Id;
            row.data = [];
            row.checked = item.checked;
            row.status = item.status;
            row.msg = item.msg;
            let fieldValues = this.fieldsApiToDetails.map(field => {
                let eachFieldValue = new FieldDetail();
                eachFieldValue.api = field.api;
                eachFieldValue.value = item[field.api];
                eachFieldValue.type = field.Type;
                return eachFieldValue;
            });
            row.data = fieldValues;
            return row;
        });
        console.log('rows', rows);
        return rows;
    }
    get disableUpdateCS() {
        let selectedItems = this.customSettingRecordList.filter(item => {
            return item.checked;
        });
        return this.customSettingRecordList.length == 0 || selectedItems.length == 0;
    }

    //OCS end

    //loaders
    welcomeLoading = true;
    currentScreen = 'WELCOME';
    currentOperation;
    showModal;

    DSAJLoading = false;
    DASLoading = false;
    DOWFLoading = false;
    UOWFLoading = false;
    OCSLoading = false;

    showProgressDOWF = false;
    showProgressUOWF = false;

    get showWelcomeScreen() {
        return this.currentScreen == 'WELCOME';
    }
    get showDSAJScreen() {
        return this.currentScreen == 'DSAJ';
    }
    get showDASScreen() {
        return this.currentScreen == 'DAS';
    }
    get showDOWFScreen() {
        return this.currentScreen == 'DOWF';
    }
    get showUOWFScreen() {
        return this.currentScreen == 'UOWF';
    }
    get showOCSScreen() {
        return this.currentScreen == 'OCS';
    }

    //common variables or getters - start
    get currentSectionHeader() {
        switch (this.currentScreen) {
            
            case 'UOWF':
                return 'Update Outbound Endpoints';
            case 'OCS':
                return 'Overwrite Custom Settings';
            default:
                return 'Welcome';
        }
    }
    get isLoading() {
        return false;//this.welcomeLoading || this.DASLoading || this.DSAJLoading || this.DOWFLoading || this.UOWFLoading || this.OCSLoading;
    }
    get isProcessing() {
        return (this.showDOWFScreen && this.showProgressDOWF)
            || (this.showUOWFScreen && this.showProgressUOWF);
    }
    get progress() {
        switch (this.currentOperation) {
            case 'OUTBOUNDUPDATE':
                {
                    return this.outboundProcessed * 100 / this.outboundsSelected.length;
                }
            case 'WORKFLOWFILTERING':
                {
                    return this.wfProcessed * 100 / this.allWorkflowRules.length;
                }
            case 'WORKFLOWDEACTIVATING':
                {
                    return this.wfProcessed * 100 / this.workflowsSelected.length;
                }
            case 'FIELDUPDATEFILTERING':
                {
                    return this.fuProcessed * 100 / this.allFieldUpdates.length;
                }
            case 'FIELDUPDATEMASKING':
                {
                    return this.fuProcessed * 100 / this.fieldUpdatesSelected.length;
                }
            default:
                return 0;
        }
    }
    get getTrue() {
        return true;
    }
    get getFalse() {
        return false;
    }
    get modalClass() {
        switch (this.currentScreen) {
            case 'OCS':
                return 'slds-modal__container widestModal';
            default:
                return 'slds-modal__container widerModal';
        }
    }
    //common variables or getters - end


    //navigate
    navigateToScreen(e) {
        console.log(e.target.getAttribute('data-id'));

        let selectedoption = e.target.getAttribute('data-id');
        switch (selectedoption) {
            case 'DSAJ':
                {
                    console.log('current screen DSAJ');
                    this.currentScreen = 'DSAJ';
                    this.showModal = true;

                    if (this.DSAJData) {
                        this.initDataToChild(this.DSAJData, DSAJCompName);
                    }
                    if (this.errorDSAJ) {
                        this.initErrorToChild(this.errorDSAJ, DSAJCompName);
                    }
                    break;
                }
            case 'DAS':
                {
                    console.log('current screen DAS');
                    this.currentScreen = 'DAS'
                    this.showModal = true;
                    if (this.DASData) {
                        this.initDataToChild(this.DASData, DASCompName);
                    }
                    if (this.errorDAS) {
                        this.initErrorToChild(this.errorDAS, DASCompName);
                    }
                    break;
                }
            case 'DOWF':
                {
                    this.currentScreen = 'DOWF';
                    this.showModal = true;
                    if (this.DOWFData) {
                        this.initDataToChild(this.DOWFData, DOWFCompName);
                    }
                    if (this.errorDOWF) {
                        this.initErrorToChild(this.errorDOWF, DOWFCompName);
                    }
                    if (this.DOWFWarnings) {
                        this.initDataToChild(this.DOWFWarnings, DOWFCompName);
                    }
                    break;
                }
            case 'UOWF':
                {
                    this.currentScreen = 'UOWF';
                    this.showModal = true;
                    if (!this.UOWFLoading) {
                        if (this.errorUOWF) {
                            showErrorToastWithMsg(this, this.errorUOWF);
                        }
                    }
                    break;
                }
            case 'OCS':
                {
                    this.currentScreen = 'OCS';
                    this.showModal = true;
                    if (!this.OCSLoading) {
                        if (this.errorOCS) {
                            showErrorToastWithMsg(this, this.errorOCS);
                        }
                    }
                    break;
                }
            case 'SED':
                {
                    this.currentScreen = 'SED';
                    window.open('/lightning/setup/OrgEmailSettings/home');
                    break;
                }
            default:
                {

                }
        }

    }

    initErrorToChild(error, compName) {
        setTimeout(() => {
            let child = this.template.querySelector(compName);
            if (child) {
                child.initiateError(error);
            }
        }, 100);
    }

    initDataToChild(data, compName) {
        setTimeout(() => {
            let child = this.template.querySelector(compName);
            if (child) {
                child.initiateData(data);
            }
        }, 100);
    }

    initWarningToChild(data, compName) {
        setTimeout(() => {
            let child = this.template.querySelector(compName);
            if (child) {
                child.initiateWarning(data);
            }
        }, 100);
    }

    //UOWF start
    handleEndpointChange(e) {
        console.log(e.target.value);
        console.log(e.target.getAttribute('data-id'));//index
        let index = e.target.getAttribute('data-id');
        this.allOutboundMsgs[index].endpointURL = e.target.value;
    }
    updateEndpoints() {
        console.log(this.allOutboundMsgs);

        //purposefully slow to track each update
        this.outboundsSelected = this.allOutboundMsgs.filter(item => {
            return item.checked;
        });
        this.showProgressUOWF = true;
        this.currentOperation = 'OUTBOUNDUPDATE';
        this.intervalTimer = setInterval(() => {
            this.chainingIndex++;
            this.updateOutboundEndpointForOne(this.chainingIndex);
        }, 500);

    }

    async updateOutboundEndpointForOne(index) {
        console.log(index, new Date());
        if (index == this.outboundsSelected.length) {
            clearInterval(this.intervalTimer);
            this.showProgressUOWF = false;
            this.chainingIndex = -1;
            return;
        }
        let result = await updateOutboundEndpoints({ "obId": this.outboundsSelected[index].Id, "endpointUrl": this.outboundsSelected[index].endpointURL });
        console.log('result', result);
        let resultObj = JSON.parse(result);
        if (resultObj.isSuccess) {
            let mainIndex = this.outboundsSelected[index].index;
            this.allOutboundMsgs[mainIndex].status = 'done';
            this.allOutboundMsgs[mainIndex].checked = false;
            this.allOutboundMsgs = [...this.allOutboundMsgs];
        }
        else {
            let mainIndex = this.outboundsSelected[index].index;
            this.allOutboundMsgs[mainIndex].status = 'failed';
            this.allOutboundMsgs[mainIndex].msg = resultObj.errorMsgs.join(',');
            this.allOutboundMsgs[mainIndex].checked = false;
            this.allOutboundMsgs = [...this.allOutboundMsgs];
        }
        if (++this.outboundProcessed == this.outboundsSelected.length) {
            this.showProgressUOWF = false;
            this.currentOperation = null;
            this.outboundProcessed = 0;
        }
    }
    //UOWF end

    //OCS start
    handleCSChange(e) {
        this.selectedCS = e.detail.value;
        console.log(this.selectedCS);
        this.OCSLoading = true;
        fetchCustomSettingMetadataAndData({ 'csName': this.selectedCS })
            .then(result => {
                console.log(JSON.parse(result));
                let resultObj = JSON.parse(result);
                if (resultObj.isSuccess) {
                    if (resultObj.returnValue) {
                        console.log(resultObj.returnValue.fieldsApiToDetails);
                        this.fieldsApiToDetails = resultObj.returnValue.fieldsApiToDetails;
                        this.customSettingRecordList = resultObj.returnValue.recordList.map(item => {
                            item.status = 'init';
                            return item;
                        });
                    }
                }
                this.OCSLoading = false;
            })
            .catch(error => {
                console.log(error);
                this.OCSLoading = false;
                showErrorToast(this, error);
            });
    }
    //TODO: check the field value change and revert the selection checkbox if change is reverted
    handleCSFieldValueChange(e) {
        console.log(e.target.getAttribute('data-id'));//index
        console.log(e.target.getAttribute('data-var'));//field
        let value;
        switch (e.target.type) {
            case 'checkbox': {
                value = e.target.checked;
                break;
            }
            default: {
                value = e.target.value;
            }
        }
        console.log(value);//value
        let index = e.target.getAttribute('data-id');
        let fieldName = e.target.getAttribute('data-var');
        this.customSettingRecordList[index][fieldName] = value;
        this.customSettingRecordList[index]['checked'] = true;
        //TODO: check for change-revert and make checked=false
        this.customSettingRecordList = [...this.customSettingRecordList];
    }
    updateCustomSettings() {
        this.OCSLoading = true;
        let selectedItems = this.customSettingRecordList.filter(item => {
            return item.checked;
        });
        updateCustomSettings({ 'selectedCSListJSON': JSON.stringify(selectedItems), 'csName': this.selectedCS })
            .then(result => {
                let resultObj = JSON.parse(result);
                console.log(resultObj);
                if (resultObj.isSuccess) {
                    resultObj.returnValue.successResults.forEach(item => {
                        this.customSettingRecordList = this.customSettingRecordList.map(mainItem => {
                            if (mainItem.Id == item.Id) {
                                item.isSuccess ? item.status = 'done' : item.status = 'failed';
                                return item;
                            }
                            return mainItem;
                        });
                    });
                    this.OCSLoading = false;
                }
                else {
                    this.OCSLoading = false;
                    showErrorToast(this, resultObj.errorMsgs);
                }
            })
            .catch(error => {
                console.log(error);
                this.OCSLoading = false;
                showErrorToast(this, error);
            });
    }
    //OCS end

    connectedCallback() {
        console.log('connected callback called');
        //DSAJ
        //DAS
        let DSAJpromise = new Promise((resolve, reject) => {
            invokeFetchScheduledApexJobs(resolve, reject);
        });
        DSAJpromise.then((data) => {
            //if DSAJ loaded, pass it
            //else store it for later
            console.log('resolved');
            if (this.showDSAJScreen) {
                console.log('showDSAJScreen');
                let DSAJScreen = this.template.querySelector(DSAJCompName);
                console.log('dsaj', DSAJScreen);
                if (DSAJScreen) {
                    DSAJScreen.initiateData(data);
                }
            }
            else {
                this.DSAJData = data;
            }

            //if DAS loaded, pass it
            //else store it for later
            if (this.showDASScreen) {
                console.log('showDASScreen');
                let DASScreen = this.template.querySelector(DASCompName);
                console.log('DASScreen', DASScreen);
                if (DASScreen) {
                    DASScreen.initiateData(data);
                }
            }
            else {
                this.DASData = data;
            }
        }).catch((error) => {
            //if DSAJ loaded, pass it
            //else store it for later
            console.log('error', error);
            if (this.showDSAJScreen) {
                let DSAJScreen = this.template.querySelector(DSAJCompName);
                if (DSAJScreen) {
                    DSAJScreen.initiateError(error);
                }
            }
            else {
                this.errorDSAJ = error;
            }
            //if DAS loaded, pass it
            //else store it for later
            if (this.showDASScreen) {
                let DASScreen = this.template.querySelector(DASCompName);
                if (DASScreen) {
                    DASScreen.initiateError(error);
                }
            }
            else {
                this.errorDAS = error;
            }
        });

        //DOWF
        let DOWFpromise = new Promise((resolve, reject)=>{
            invokeFetchAndFilterOutboundWorkflows(resolve, reject);
        });
        DOWFpromise.then((data, warnings)=>{
            //if DOWF loaded, pass it
            //else store it for later
            if(this.showDOWFScreen)
            {
                let DOWFScreen = this.template.querySelector(DOWFCompName);
                console.log('DOWF', DOWFScreen);
                if (DOWFScreen) {
                    DOWFScreen.initiateData(data);
                    DOWFScreen.initiateWarning(warnings);
                }
            }
            else{
                this.DOWFData = data;
                this.DOWFWarnings = warnings;
            }
        }).catch((error)=>{
            //if DOWF loaded, pass it
            //else store it for later
            console.log('error', error);
            if (this.showDOWFScreen) {
                let DOWFScreen = this.template.querySelector(DOWFCompName);
                if (DOWFScreen) {
                    DOWFScreen.initiateError(error);
                }
            }
            else {
                this.errorDOWF = error;
            }
        });


        /*
         this.DOWFLoading = true;
         fetchOutboundWorkflows()
             .then(result => {
                 let resultObj = JSON.parse(result);
                 if (resultObj.isSuccess) {
                     this.allWorkflowRules = [];
                     this.workflowsSelected = [];
                     resultObj.returnValue.workflows.forEach((item, index) => {
                         item = { ...item, ...{ 'index': index } };
                         this.allWorkflowRules.push(item);
                     });
                     this.DOWFLoading = false;
                     setTimeout(() => { this.filterWorkflows(); }, 10);
                 }
                 else {
                     this.DOWFLoading = false;
                     this.errorDOWF = resultObj.errorMsgs;
                 }
             })
             .catch(error => {
                 this.DOWFLoading = false;
                 this.errorDOWF = error;
             });
         */
        /*
        this.UOWFLoading = true;
        fetchAllOutboundMsgs()
            .then(result => {
                console.log('result', result);
                let resultObj = JSON.parse(result);
                if (resultObj.isSuccess) {
                    this.allOutboundMsgs = [];
                    this.outboundsSelected = [];
                    //TODO: Show original URL & object name
                    resultObj.returnValue.outboundgMsgs.forEach((item, index) => {
                        item = { ...item, ...{ 'endpointURL': 'www.test.com' } };
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
                        this.allOutboundMsgs.push(item);
                    });
                    this.UOWFLoading = false;
                }
                else {
                    this.UOWFLoading = false;
                    this.errorUOWF = resultObj.errorMsgs;
                }
            })
            .catch(error => {
                console.log('error', error);
                this.UOWFLoading = false;
                this.errorUOWF = error;
            });
        */
        this.OCSLoading = true;
        fetchCustomSettingList()
            .then(result => {
                let resultObj = JSON.parse(result);
                if (resultObj.isSuccess) {
                    if (resultObj.returnValue && resultObj.returnValue.csList) {
                        this.customSettingOptions = [];
                        for (const [api, label] of Object.entries(resultObj.returnValue.csList)) {
                            this.customSettingOptions.push({ label: label + '[' + api + ']', value: api });
                        }
                    }
                }
                this.OCSLoading = false;
            })
            .catch(error => {
                console.log('error', error);
                this.OCSLoading = false;
            });
    }
    @wire(fetchOrgInformation)
    processOrgInfo({ error, data }) {
        if (data) {
            let result = JSON.parse(data);
            if (result.isSuccess) {
                this.orgName = result.returnValue.orgName;
                this.orgURL = result.returnValue.orgUrl;
                this.orgType = result.returnValue.orgType;
                this.isSandbox = result.returnValue.isSandbox;
                this.name = result.returnValue.name;
            }
            else {
                console.log(result);
                showErrorToast(this, result.errorMsgs);
            }
        }
        else if (error) {
            console.log(error);
            showErrorToast(this, error);
        }
        this.welcomeLoading = false;
    }
    selectAllToggle(e) {
        switch (this.currentScreen) {
            case 'DOWF':
                {
                    this.filteredWorkflowRules = this.filteredWorkflowRules.map(item => {
                        item.checked = e.target.checked;
                        return item;
                    });
                    break;
                }
            case 'UOWF':
                {
                    this.allOutboundMsgs = this.allOutboundMsgs.map(item => {
                        item.checked = e.target.checked;
                        return item;
                    });
                    break;
                }
            case 'OCS':
                {
                    this.customSettingRecordList = this.customSettingRecordList.map(item => {
                        item.checked = e.target.checked;
                        return item;
                    });
                    break;
                }
            default:
                {

                }
        }

    }
    handleSelectionChange(e) {
        let index = e.target.getAttribute('data-id');
        switch (this.currentScreen) {

            case 'DOWF':
                {
                    this.filteredWorkflowRules[index].checked = e.target.checked;
                    this.filteredWorkflowRules = [...this.filteredWorkflowRules];
                    break;
                }
            case 'UOWF':
                {
                    this.allOutboundMsgs[index].checked = e.target.checked;
                    this.allOutboundMsgs = [...this.allOutboundMsgs];
                    console.log(this.allOutboundMsgs);
                    break;
                }
            case 'OCS':
                {
                    this.customSettingRecordList[index].checked = e.target.checked;
                    this.customSettingRecordList = [...this.customSettingRecordList];
                    console.log(this.customSettingRecordList);
                    break;
                }
            default:
                {

                }
        }

    }
    
    cancel() {
        this.showModal = false;
        this.currentScreen = '';
    }
}
