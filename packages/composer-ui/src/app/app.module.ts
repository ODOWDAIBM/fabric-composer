import { NgModule, ApplicationRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { RouterModule, PreloadAllModules } from '@angular/router';
import { removeNgStyles, createNewHosts, createInputTransfer } from '@angularclass/hmr';
import { ModalModule, TooltipModule } from 'ng2-bootstrap';
import { ComponentLoaderFactory } from 'ng2-bootstrap/component-loader';
import { LocalStorageModule } from 'angular-2-local-storage';

/*
 * Platform and Environment providers/directives/pipes
 */
import { ENV_PROVIDERS } from './environment';
import { ROUTES } from './app.routes';
// App is our top level component
import { AppComponent } from './app.component';
import { APP_RESOLVER_PROVIDERS } from './app.resolver';
import { AppState, InternalStateType } from './app.service';
import { EditorComponent } from './editor';
import { AssetRegistriesComponent } from './assetregistries';
import { AssetRegistryComponent, AddAssetComponent, UpdateAssetComponent, RemoveAssetComponent } from './assetregistry';
import { ParticipantRegistriesComponent } from './participantregistries';
import { ParticipantRegistryComponent, AddParticipantComponent, UpdateParticipantComponent, RemoveParticipantComponent, IssueIdentityComponent, IssuedIdentityComponent } from './participantregistry';
import { TransactionRegistryComponent, SubmitTransactionComponent } from './transactionregistry';
import { SettingsComponent } from './settings';
import { AddIdentityComponent } from './addidentity';
import { BusyComponent } from './busy';
import { ErrorComponent } from './error';
import { ResetComponent } from './reset';
import { SampleComponent } from './sample';
import { NoContentComponent } from './no-content';
import { CodemirrorModule } from 'ng2-codemirror';

import { AdminService } from './admin.service';
import { ClientService } from './client.service';
import { ConnectionProfileService } from './connectionprofile.service';
import { WalletService } from './wallet.service';
import { IdentityService } from './identity.service';
import { NotificationService } from './notification.service';
import { SampleService } from './sample.service';
import { InitializationService } from './initialization.service';

// Application wide providers
const APP_PROVIDERS = [
  ...APP_RESOLVER_PROVIDERS,
  AppState
];

type StoreType = {
  state: InternalStateType,
  restoreInputValues: () => void,
  disposeOldHosts: () => void
};

/**
 * `AppModule` is the main entry point into Angular2's bootstraping process
 */
@NgModule({
  bootstrap: [ AppComponent ],
  declarations: [
    AppComponent,
    EditorComponent,
    AssetRegistriesComponent,
    AssetRegistryComponent,
    AddAssetComponent,
    UpdateAssetComponent,
    RemoveAssetComponent,
    ParticipantRegistriesComponent,
    ParticipantRegistryComponent,
    AddParticipantComponent,
    UpdateParticipantComponent,
    RemoveParticipantComponent,
    IssueIdentityComponent,
    IssuedIdentityComponent,
    TransactionRegistryComponent,
    SubmitTransactionComponent,
    SettingsComponent,
    AddIdentityComponent,
    BusyComponent,
    ErrorComponent,
    ResetComponent,
    SampleComponent,
    NoContentComponent
  ],
  imports: [ // import Angular's modules
    BrowserModule,
    FormsModule,
    HttpModule,
    RouterModule.forRoot(ROUTES, { useHash: true, preloadingStrategy: PreloadAllModules }),
    CodemirrorModule,
    ModalModule.forRoot(),
    TooltipModule.forRoot(),
    LocalStorageModule.withConfig({
      prefix: 'Concerto',
      storageType: 'localStorage'
    })
  ],
  providers: [ // expose our Services and Providers into Angular's dependency injection
    ENV_PROVIDERS,
    APP_PROVIDERS,
    AdminService,
    ClientService,
    ConnectionProfileService,
    WalletService,
    IdentityService,
    NotificationService,
    SampleService,
    InitializationService
  ]
})
export class AppModule {
  constructor(public appRef: ApplicationRef, public appState: AppState) {}

  hmrOnInit(store: StoreType) {
    if (!store || !store.state) return;
    console.log('HMR store', JSON.stringify(store, null, 2));
    // set state
    this.appState._state = store.state;
    // set input values
    if ('restoreInputValues' in store) {
      let restoreInputValues = store.restoreInputValues;
      setTimeout(restoreInputValues);
    }

    this.appRef.tick();
    delete store.state;
    delete store.restoreInputValues;
  }

  hmrOnDestroy(store: StoreType) {
    const cmpLocation = this.appRef.components.map(cmp => cmp.location.nativeElement);
    // save state
    const state = this.appState._state;
    store.state = state;
    // recreate root elements
    store.disposeOldHosts = createNewHosts(cmpLocation);
    // save input values
    store.restoreInputValues  = createInputTransfer();
    // remove styles
    removeNgStyles();
  }

  hmrAfterDestroy(store: StoreType) {
    // display new elements
    store.disposeOldHosts();
    delete store.disposeOldHosts;
  }

}

