// This file is required by karma.conf.js and initializes the Angular testing environment. The Karma builder finds
// and loads the .spec files itself.

import 'zone.js/testing';
import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

/**
 * Runs specs with zone.js change detection, like main.ts. Since Angular 21 TestBed is zoneless by default, which turns
 * on fixture auto-detection and changes when change detection runs in every component spec.
 */
@NgModule({ providers: [provideZoneChangeDetection()] })
class ZoneChangeDetectionTestingModule {
}

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  [BrowserDynamicTestingModule, ZoneChangeDetectionTestingModule],
  platformBrowserDynamicTesting()
);