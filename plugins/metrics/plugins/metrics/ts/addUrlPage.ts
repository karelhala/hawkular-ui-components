/// Copyright 2014-2015 Red Hat, Inc. and/or its affiliates
/// and other contributors as indicated by the @author tags.
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///   http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.

/// <reference path="metricsPlugin.ts"/>
/// <reference path="alertsManager.ts"/>
/// <reference path="errorManager.ts"/>

module HawkularMetrics {


  export class AddUrlController {
    /// this is for minification purposes
    public static $inject = ['$location', '$scope', '$rootScope', '$interval', '$log', '$filter', 'HawkularInventory', 'HawkularMetric', 'HawkularAlert', 'HawkularAlertsManager','HawkularErrorManager','$q'];

    private httpUriPart = 'http://';
    public addProgress: boolean = false;
    private resourceList;

    constructor(private $location:ng.ILocationService,
                private $scope:any,
                private $rootScope:ng.IRootScopeService,
                private $interval:ng.IIntervalService,
                private $log:ng.ILogService,
                private $filter:ng.IFilterService,
                private HawkularInventory:any,
                private HawkularMetric:any,
                private HawkularAlert:any,
                private HawkularAlertsManager: HawkularMetrics.IHawkularAlertsManager,
                private HawkularErrorManager: HawkularMetrics.IHawkularErrorManager,
                private $q: ng.IQService,
                public resourceUrl:string) {
      $scope.vm = this;
      this.resourceUrl = this.httpUriPart;
      this.getResourceList();
      this.autoRefresh(20);
    }

    private autoRefreshPromise:ng.IPromise<number>;

    cancelAutoRefresh():void {
      this.$interval.cancel(this.autoRefreshPromise);
      toastr.info('Canceling Auto Refresh');
    }

    autoRefresh(intervalInSeconds:number):void {
      this.autoRefreshPromise = this.$interval(()  => {
        this.getResourceList();
      }, intervalInSeconds * 1000);

      this.$scope.$on('$destroy', () => {
        this.$interval.cancel(this.autoRefreshPromise);
      });
    }

    addUrl(url:string):void {
      this.addProgress = true;

      var resource = {
        type: 'URL',
        id: '',
        parameters: {
          url: url
        }
      };

      this.$log.info('Adding new Resource Url to Hawkular-inventory: ' + url);

      globalChartTimeRange = new ChartTimeRange(1);
      var metricId: string;

      /// Add the Resource
      this.HawkularInventory.Resource.save({tenantId: globalTenantId}, resource).$promise
        .then((newResource) => {
          // we now have a resourceId from this call
          metricId = newResource.id;
          console.dir(newResource);
          this.$log.info('New Resource ID: ' + metricId + ' created.');
          var metrics = [{
            name: metricId + '.status.duration',
            unit: 'MILLI_SECOND',
            description: 'Response Time in ms.'
          }, {
            name: metricId + '.status.code',
            unit: 'NONE',
            description: 'Status Code'
          }];


          /// For right now we will just Register a couple of metrics automatically
          return this.HawkularInventory.Metric.save({
            tenantId: globalTenantId,
            resourceId: newResource.id
          }, metrics).$promise.then((newMetrics) => {
              // TODO: Add availability...
            });
        }).then(()=> {
          // Find if a default email exists
          return this.HawkularAlertsManager.addEmailAction('myemail@company.com');
        }, (error)=> {
          return this.HawkularErrorManager.errorHandler(error, 'Error saving metric.');
        }).then(()=> {
          // Create threshold trigger for newly created metrics
          return this.HawkularAlertsManager.createTrigger(metricId + '_trigger_thres', true, 'THRESHOLD', 'myemail@company.com');
        }, (error)=> {
          return this.HawkularErrorManager.errorHandler(error, 'Error saving email action.');
        }).then((alert)=> {
          // Create availability trigger for newly created metrics
          return this.HawkularAlertsManager.createTrigger(metricId + '_trigger_avail', false, 'AVAILABILITY', 'myemail@company.com');
        }, (error)=> {
          return this.HawkularErrorManager.errorHandler(error, 'Error saving threshold trigger.');
        }).then(()=> {
          toastr.info('Your data is being collected. Please be patient (should be about another minute).');
          this.$location.url('/metrics/response-time/' + metricId);
        }, (error)=> {
          return this.HawkularErrorManager.errorHandler(error, 'Error saving availability trigger.');
        }).finally(()=> {
          this.addProgress = false;
        });
    }

    getResourceList():any {
      return this.HawkularInventory.Resource.query({tenantId: globalTenantId}, (aResourceList) => {
        // FIXME: hack.. make expanded out of list
        var expanded = this.resourceList ? this.resourceList.expanded : [];
        this.resourceList = aResourceList;
        this.resourceList.expanded = expanded;
        angular.forEach(this.resourceList, function(res, idx) {
          this.HawkularMetric.NumericMetricData.queryMetrics({
            tenantId: globalTenantId, resourceId: res.id, numericId: (res.id + '.status.duration'),
            start: moment().subtract(1, 'hour').valueOf(), end: moment().valueOf()}, (resource) => {
            // FIXME: Work data so it works for chart ?
            res['responseTime'] = resource;
          });
          this.HawkularMetric.NumericMetricData.queryMetrics({
            tenantId: globalTenantId, resourceId: res.id, numericId: (res.id + '.status.code'),
            start: moment().subtract(1, 'hour').valueOf(), end: moment().valueOf()}, (resource) => {
            // FIXME: Use availability instead..
            res['isUp'] = (resource[0] && resource[0].value >= 200 && resource[0].value < 300);
            var upTime = 0;
            for(var i = 0; i < resource.length; i++) {
              if(resource[i].value >= 200 && resource[i].value < 300) {
                upTime++;
              }
            }
            res['availability'] = resource.length > 0 ? upTime/resource.length * 100 : 0;
            res['downTime'] = resource.length > 0 ? resource.length - upTime : 'every';
          });
          this.HawkularAlert.Alert.query({ query: res.id, start: moment().subtract(1, 'hour').valueOf(),
            end: moment().valueOf()}, (alertsList) => {
            res['alerts'] = [];
            for(var i = 0; i < alertsList.length; i++) {
              if (alertsList[i].evalSets[0][0].condition.dataId.indexOf(res.id) === 0) {
                res['alerts'].push(alertsList[i].evalSets[0][0]);
              }
            }
          });
          res['updateTime'] = new Date();
        }, this);

      });
    }

    getAverage(data:any, field:string):number {
      if (data) {
        var sum = 0;
        for (var i = 0; i < data.length; i++) {
          sum += parseInt(data[i][field], 10);
        }
        return Math.round(sum / data.length);
      }
    }

    deleteResource(resource:any):any {
      // TODO: use modal to confirm delete...
      this.HawkularInventory.Resource.delete({
        tenantId: globalTenantId,
        resourceId: resource.id
      }).$promise.then((res) => {
          toastr.info('The site ' + resource.parameters.url + ' is no longer being monitored.');
          this.resourceList = this.getResourceList();
        });
    }

  }

  _module.controller('HawkularMetrics.AddUrlController', AddUrlController);

}
