import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { reduceErrors } from 'c/ldsUtils';

export function showSuccessToast(self, msg) {
    const evt = new ShowToastEvent({
        title: 'Success',
        message: msg,
        variant: 'success',
    });
    self.dispatchEvent(evt);
}
export function showErrorToastWithMsg(self, msg) {
    const evt = new ShowToastEvent({
        title: 'Error',
        message: msg,
        variant: 'error',
        mode: 'sticky'
    });
    self.dispatchEvent(evt);
}
export function showErrorToast(self, err) {
    console.log(err instanceof String);
    let errorMsg;
    if (typeof err == 'string') {
        errorMsg = err;
    }
    else {
        errorMsg = reduceErrors(err).join(', ');
    }
    const evt = new ShowToastEvent({
        title: 'Error',
        message: errorMsg,
        variant: 'error',
        mode: 'sticky'
    });
    self.dispatchEvent(evt);
}

/*
{
    "message":"An error occurred while trying to update the record. Please try again.",
    "detail":"The Estimated Deal Close Date cannot be before today's date.",
    "output":{
        "errors":
        [
            {"constituentField":null,"duplicateRecordError":null,
            "errorCode":"FIELD_CUSTOM_VALIDATION_EXCEPTION","field":null,"fieldLabel":null,
            "message":"The Estimated Deal Close Date cannot be before today's date."}
        ],
        "fieldErrors":{}
    }
}
*/
export function findDisplayableErrorMessage(payload) {
    if (payload) {
        let errorMsg = '';
        for (let errIndex in payload.output.errors) {
            errorMsg += payload.output.errors[errIndex].message;
        }
        return errorMsg;
    }
}
export function isNullOrBlankOrZeroOrUndefined(val) {
    return val == null || val == '' || val == 0 || val == undefined;
}
export function clone(obj) {
    //in case of premitives
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    //date objects should be 
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    //handle Array
    if (Array.isArray(obj)) {
        var clonedArr = [];

        obj.forEach(function (element) {
            let clObj = clone(element);
            clonedArr.push(clObj);
        });
        return clonedArr;
    }

    //lastly, handle objects
    let clonedObj = new obj.constructor();
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            clonedObj[prop] = clone(obj[prop]);
        }
    }
    return clonedObj;
}
