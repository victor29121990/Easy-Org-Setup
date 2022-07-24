public with sharing class OrgRefresherHelper {
    @AuraEnabled(cacheable=true)
    public static string fetchOrgInformation(){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            Organization org = [SELECT IsSandbox,Name,OrganizationType 
                                FROM Organization
                                WHERE Id = :UserInfo.getOrganizationId() ];
            wrap.returnValue.put('orgName', URL.getSalesforceBaseUrl().getHost().subStringAfter('--').subStringBefore('.'));
            wrap.returnValue.put('name', UserInfo.getName());
            wrap.returnValue.put('orgUrl', URL.getSalesforceBaseUrl().getHost());
            wrap.returnValue.put('orgType', org.OrganizationType);
            wrap.returnValue.put('isSandbox', org.IsSandbox);
            wrap.isSuccess = true;    
        } catch (Exception e) {
            wrap.isSuccess = false;
            wrap.errorMsgs = new List<String>{e.getMessage()};
            
        }
        
        return JSON.serialize(wrap);
    }
    @AuraEnabled
    public static string updateCustomSettings(String selectedCSListJSON, String csName){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            List<SObject> selectedCSList = (List<SObject>)JSON.deserialize(selectedCSListJSON, List<SObject>.class); 
            System.debug(selectedCSList);
            String listType = 'List<' + csName + '>';
            List<SObject> castRecords = (List<SObject>)Type.forName(listType).newInstance();
            castRecords.addAll(selectedCSList);
            Database.SaveResult[] srList = Database.update(castRecords, false);

            List<Object> resultsToReturn = new List<Object>();
            Integer index = 0;
            for (Database.SaveResult sr : srList) {
                if (sr.isSuccess()) {
                    Map<String, Object> objectMap = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(castRecords[index]));
                    objectMap.put('isSuccess', true);
                    resultsToReturn.add(objectMap);
                }
                else {
                    String errorMsgs = '';              
                    for(Database.Error err : sr.getErrors()) {
                        System.debug('The following error has occurred.');                    
                        System.debug(err.getStatusCode() + ': ' + err.getMessage());
                        System.debug('Account fields that affected this error: ' + err.getFields());
                        errorMsgs += err.getMessage();
                    }
                    Map<String, Object> objectMap = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(castRecords[index]));
                    objectMap.put('isSuccess', false);
                    objectMap.put('msg', errorMsgs);
                    resultsToReturn.add(objectMap);
                }
                index++;
            }
            wrap.isSuccess = true;
            wrap.returnValue.put('successResults', resultsToReturn);
        } catch (Exception e) {
            wrap.isSuccess = false;
            wrap.errorMsgs = new List<String>{e.getMessage()};
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled(cacheable=true)
    public static string fetchCustomSettingMetadataAndData(String csName){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            Schema.SObjectType r = ((SObject)Type.forName('Schema',csName).newInstance()).getSObjectType();
            Schema.DescribeSObjectResult d = r.getDescribe();
            Map<String,Schema.SObjectField> fieldsMap = d.fields.getMap();
            List<Map<String, String>> fieldsApiToDetails = new List<Map<String, String>>();
            for(Schema.SObjectField fld : fieldsMap.values()) {
                Schema.DescribeFieldResult fd = fld.getDescribe();
                if(fd.isCustom() || fd.isNameField())
                {
                    fieldsApiToDetails.add(new Map<String, String>{'api'=>fd.getName(),'Label'=>fd.getLabel(), 'Type'=>String.valueOf(fd.getType())});
                }
            }
            wrap.returnValue.put('fieldsApiToDetails', fieldsApiToDetails);
            System.debug(wrap.returnValue);
            String query = 'Select';
            for(Map<String, String> eachField : fieldsApiToDetails)
            {
                query += ' '+eachField.get('api')+',';
            }
            query += ' Id';
            query += ' from '+csName;
            System.debug(query);
            List<sObject> recordList = Database.query(query);
            System.debug(recordList);
            wrap.returnValue.put('recordList', recordList);
            wrap.isSuccess = true;
        } catch (Exception e) {
            wrap.isSuccess = false;
            wrap.errorMsgs = new List<String>{e.getMessage()};
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled(cacheable=true)
    public static string fetchCustomSettingList(){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
            Map<String, String> csMap = new Map<String, String>();
            for(String objectName :gd.keySet()){
                Schema.SObjectType result=gd.get(objectName);
                Schema.DescribeSObjectResult describeResult = result.getDescribe();
                if(describeResult.isCustomSetting()){
                    //checking for Settings Type = List
                    Schema.DescribeFieldResult dfr = describeResult.fields.getMap().get('Name').getDescribe(); 
                    if(!dfr.isNillable())
                    {
                        csMap.put(objectName, describeResult.getLabel());
                    }
                }
            }
            wrap.isSuccess = true;
            wrap.returnValue.put('csList', csMap);
        } catch (Exception e) {
            wrap.isSuccess = false;
            wrap.errorMsgs = new List<String>{e.getMessage()};
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled
    public static String fetchScheduledApexJobs(){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            Map<String, String> jobtypeMap = new Map<String, String>();
            jobtypeMap.put('1','Data Export');
            jobtypeMap.put('3','Dashboard Refresh');
            jobtypeMap.put('4','Reporting Snapshot');
            jobtypeMap.put('6','Scheduled Flow');
            jobtypeMap.put('7','Scheduled Apex');
            jobtypeMap.put('8','Report Run');
            jobtypeMap.put('9','Batch Job');
            jobtypeMap.put('A','Reporting Notification');

            Map<String, List<CronTrigger>> mapOfJobs = new Map<String, List<CronTrigger>>();
            for(CronTrigger ct : [SELECT Id,CronJobDetail.Name,
                                    CronJobDetail.JobType,NextFireTime 
                                    FROM CronTrigger])
            {
                String jobTypePhrase = jobtypeMap.containsKey(ct.CronJobDetail.JobType)?
                                        jobtypeMap.get(ct.CronJobDetail.JobType):
                                        ct.CronJobDetail.JobType;
                if(!mapOfJobs.containsKey(jobTypePhrase))
                {
                    mapOfJobs.put(jobTypePhrase, new List<CronTrigger>{});
                }
                mapOfJobs.get(jobTypePhrase).add(ct);
            }
            if(!mapOfJobs.isEmpty())
            {
                wrap.returnValue = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(mapOfJobs));
                wrap.isSuccess = true;
            }
            else{
                wrap.returnValue = new Map<string, Object>();
                wrap.isSuccess = true;
            }
        } catch (Exception e) {
            System.debug(e.getStackTraceString());
            wrap.errorMsgs = new List<String>{e.getMessage() + e.getStackTraceString()};
            wrap.isSuccess = false;
        }
        return JSON.serialize(wrap);
    }

    @AuraEnabled
    public static string disableApexJobs(String cronIdsAsString){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<String, Object>();
            wrap.isSuccess = true;
            List<String> cronIds = (List<String>)JSON.deserialize(cronIdsAsString, List<String>.class);
            if(cronIds != null && !cronIds.isEmpty())
            {
                for(String cronId : cronIds)
                {
                    try{
                        System.abortJob(cronId);
                        String jsonSuccess = '{"isSuccess":true}';
                        wrap.returnValue.put(cronId, JSON.deserializeUntyped(jsonSuccess));
                    }
                    catch(Exception e)
                    {
                        String jsonError = '{"isSuccess":false,"errorMsg":"'+e.getMessage()+'"}';
                        wrap.returnValue.put(cronId, JSON.deserializeUntyped(jsonError));
                    }
                }
            }
        } catch (Exception e) {
            wrap.isSuccess = false;
            wrap.errorMsgs = new List<String>{e.getMessage()};
        }
        return JSON.serialize(wrap);
    }

    @AuraEnabled(cacheable=true)
    public static string fetchFieldUpdates(){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            String resultJSON = OrgRefresherHelper.makeToolingAPIcall('/query/?q=Select+Id,Name+from+WorkflowFieldUpdate+where+ManageableState+=+\'unmanaged\'+AND+LiteralValue=null+AND+LookupValueId=null', 'GET');
            System.debug('resultJSON'+resultJSON);
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(resultJSON);
            if(resultMap.containsKey('done') && (Boolean)resultMap.get('done'))
            {
                wrap.returnValue.put('fieldupdates', resultMap.get('records'));
                wrap.isSuccess = true;
            }
            else
            {
                wrap.errorMsgs = new List<String>{(String)resultMap.get('message')};
                wrap.isSuccess = false;
            }
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
        }
        return JSON.serialize(wrap);
    }

    @AuraEnabled(cacheable=true)
    public static string hasHardcodedEmail(String fuId){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            String resultJSON = OrgRefresherHelper.makeToolingAPIcall('/sobjects/WorkflowFieldUpdate/'+fuId, 'GET');
            System.debug('resultJSON'+resultJSON);
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(resultJSON);
            wrap.returnValue.put('fieldupdate', resultMap);
            wrap.isSuccess = true;
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
        }
        return JSON.serialize(wrap);
    }


    @AuraEnabled(cacheable=true)
    public static string isOutboundWorkflow(String wfId){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            String resultJSON = OrgRefresherHelper.makeToolingAPIcall('/sobjects/WorkflowRule/'+wfId, 'GET');
            System.debug('resultJSON'+resultJSON);
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(resultJSON);
            wrap.returnValue.put('workflow', resultMap);
            wrap.isSuccess = true;
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled
    public static string deactivateWorkflows(String workflowJSON, String wfId){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(workflowJSON);
            if(resultMap.containsKey('Metadata'))
            {
                Map<String, Object> metadataMap = (Map<String, Object>)resultMap.get('Metadata');
                metadataMap.put('active', false);
                resultMap.put('Metadata', metadataMap);
                resultMap.remove('Id');
                resultMap.remove('Name');
                resultMap.remove('TableEnumOrId');
                resultMap.remove('CreatedDate');
                resultMap.remove('CreatedById');
                resultMap.remove('LastModifiedDate');
                resultMap.remove('LastModifiedById');
                resultMap.remove('ManageableState');
                resultMap.remove('NamespacePrefix');
                resultMap.remove('FullName');
                resultMap.remove('attributes');
                String jsonBody = JSON.serialize(resultMap);
                System.debug('jsonBody'+jsonBody);
                String updateResultJSON 
                    = OrgRefresherHelper.makeToolingAPIcall('/sobjects/WorkflowRule/'+wfId, 
                    'PATCH',
                    jsonBody);
                System.debug(updateResultJSON);
                if(String.isNotBlank(updateResultJSON))
                {
                    wrap.isSuccess = false;
                    wrap.returnValue.put('outboundId', wfId);
                    wrap.errorMsgs = new List<String>();
                    JSONParser parser = JSON.createParser(updateResultJSON);
                    while (parser.nextToken() != null) {
                        if ((parser.getCurrentToken() == JSONToken.FIELD_NAME) && 
                            (parser.getText() == 'message')) 
                        {
                            parser.nextToken();
                            wrap.errorMsgs.add(parser.getText());
                        }
                    }
                }
                else
                {
                    wrap.isSuccess = true;
                    wrap.successMsg = updateResultJSON;
                }
                wrap.returnValue.put('outboundId', wfId);
            }
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
            wrap.returnValue.put('outboundId', wfId);
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled(cacheable=true)
    public static string fetchOutboundWorkflows(){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            String resultJSON = OrgRefresherHelper.makeToolingAPIcall('/query/?q=Select+Id,Name+from+WorkflowRule+where+ManageableState+=+\'unmanaged\'', 'GET');
            System.debug('resultJSON'+resultJSON);
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(resultJSON);
            if(resultMap.containsKey('done') && (Boolean)resultMap.get('done'))
            {
                wrap.returnValue.put('workflows', resultMap.get('records'));
                wrap.isSuccess = true;
            }
            else
            {
                wrap.errorMsgs = new List<String>{(String)resultMap.get('message')};
                wrap.isSuccess = false;
            }
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled(cacheable=true)
    public static string fetchAllOutboundMsgs(){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            String resultJSON = OrgRefresherHelper.makeToolingAPIcall('/query/?q=Select+Id,Name+from+WorkflowOutboundMessage+where+ManageableState+=+\'unmanaged\'', 'GET');
            System.debug('resultJSON'+resultJSON);
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(resultJSON);
            if(resultMap.containsKey('done') && (Boolean)resultMap.get('done'))
            {
                wrap.returnValue.put('outboundgMsgs', resultMap.get('records'));
                wrap.isSuccess = true;
            }
            else
            {
                wrap.errorMsgs = new List<String>{(String)resultMap.get('message')};
                wrap.isSuccess = false;
            }
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
        }
        return JSON.serialize(wrap);
    }
    @AuraEnabled
    public static string updateOutboundEndpoints(String obId, String endpointUrl){
        ReturnWrapper wrap = new ReturnWrapper();
        try {
            wrap.returnValue = new Map<string, Object>();
            String resultJSON = OrgRefresherHelper.makeToolingAPIcall('/sobjects/WorkflowOutboundMessage/'+obId, 'GET');
            System.debug('resultJSON'+resultJSON);
            Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(resultJSON);
            if(resultMap.containsKey('Metadata'))
            {
                Map<String, Object> metadataMap = (Map<String, Object>)resultMap.get('Metadata');
                metadataMap.put('endpointUrl', endpointUrl);
                resultMap.put('Metadata', metadataMap);
                resultMap.remove('Id');
                resultMap.remove('Name');
                resultMap.remove('IntegrationUserId');
                resultMap.remove('CreatedDate');
                resultMap.remove('CreatedById');
                resultMap.remove('LastModifiedDate');
                resultMap.remove('LastModifiedById');
                resultMap.remove('ManageableState');
                resultMap.remove('NamespacePrefix');
                resultMap.remove('ApiVersion');
                resultMap.remove('EntityDefinitionId');
                resultMap.remove('FullName');
                resultMap.remove('attributes');
                String jsonBody = JSON.serialize(resultMap);
                System.debug('jsonBody'+jsonBody);
                String updateResultJSON 
                    = OrgRefresherHelper.makeToolingAPIcall('/sobjects/WorkflowOutboundMessage/'+obId, 
                    'PATCH',
                    jsonBody);
                System.debug(updateResultJSON);
                if(String.isNotBlank(updateResultJSON))
                {
                    wrap.isSuccess = false;
                    wrap.returnValue.put('outboundId', obId);
                    wrap.errorMsgs = new List<String>();
                    JSONParser parser = JSON.createParser(updateResultJSON);
                    while (parser.nextToken() != null) {
                        if ((parser.getCurrentToken() == JSONToken.FIELD_NAME) && 
                            (parser.getText() == 'message')) 
                        {
                            parser.nextToken();
                            wrap.errorMsgs.add(parser.getText());
                        }
                    }
                }
                else
                {
                    wrap.isSuccess = true;
                    wrap.successMsg = updateResultJSON;
                }
                wrap.returnValue.put('outboundId', obId);
            }
            else
            {
                wrap.errorMsgs = new List<String>{(String)resultMap.get('message')};
                wrap.isSuccess = false;
                wrap.returnValue.put('outboundId', obId);
            }
        } catch (Exception e) {
            wrap.errorMsgs = new List<String>{e.getMessage()};
            wrap.isSuccess = false;
            wrap.returnValue.put('outboundId', obId);
        }
        return JSON.serialize(wrap);
    }
    public static String makeToolingAPIcall(String endpoint, String method)
    {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:Tooling_API'+endpoint);
        req.setMethod(method);
        Http http = new Http();
        HTTPResponse res = http.send(req);
        System.debug(res.getHeader('Location'));
        return res.getBody();
    }
    public static String makeToolingAPIcall(String endpoint, String method, String jsonBody)
    {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:Tooling_API'+endpoint);
        req.setMethod(method);
        req.setHeader('Content-Type', 'application/json; charset=UTF-8');
        req.setHeader('Accept', 'application/json');
        req.setBody(jsonBody);
        Http http = new Http();
        HTTPResponse res = http.send(req);
        System.debug(res.getBody());
        return res.getBody();
    }
    public class ReturnWrapper
    {
        @AuraEnabled public Boolean isSuccess;
        @AuraEnabled public String successMsg;
        
        @AuraEnabled public Map<string, Object> returnValue; 
        @AuraEnabled public List<String> errorMsgs;
    }
}
