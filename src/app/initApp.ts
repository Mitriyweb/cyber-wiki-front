/**
 * Shared application initialization for all main.tsx template variants.
 *
 * Registers GTS schemas, API services, and creates the HAI3 app instance.
 * Each main variant imports this and only adds variant-specific rendering.
 */
// @ts-nocheck — Template source: `@/` imports resolve in generated apps, not in this package tree.
import {
  apiRegistry,
  createHAI3App,
  RestProtocol,
} from '@cyberfabric/react';
import { AccountsApiService, SpacesApiService, EnrichmentsApiService } from '@/app/api';
import { DraftChangesApiService } from '@/app/api/DraftChangesApiService';
import { UserBranchApiService } from '@/app/api/UserBranchApiService';
import { FileMappingApiService } from '@/app/api/FileMappingApiService';
import { ApiTokensApiService } from '@/app/api/ApiTokensApiService';
import { ServiceTokensApiService } from '@/app/api/ServiceTokensApiService';
import { UserSettingsApiService } from '@/app/api/UserSettingsApiService';
import { GitOpsLogApiService } from '@/app/api/GitOpsLogApiService';
import { CsrfPlugin } from '@/app/api/CsrfPlugin';
import { PerformancePlugin } from '@/app/api/PerformancePlugin';
import { AuthPlugin } from '@/app/api/AuthPlugin';
import '@/app/events/bootstrapEvents';
import '@/app/events/wikiEvents';
import '@/app/events/enrichmentEvents';
import '@/app/events/draftChangeEvents';
import '@/app/events/userBranchEvents';
import '@/app/events/fileMappingEvents';
import '@/app/events/apiTokensEvents';
import '@/app/events/userSettingsEvents';
import '@/app/events/profileEvents';
import '@/app/events/gitOpsLogEvents';
import { registerBootstrapEffects } from '@/app/effects/bootstrapEffects';
import { registerWikiEffects } from '@/app/effects/wikiEffects';
import { registerEnrichmentEffects } from '@/app/effects/enrichmentEffects';
import { registerDraftChangeEffects } from '@/app/effects/draftChangeEffects';
import { registerUserBranchEffects } from '@/app/effects/userBranchEffects';
import { registerFileMappingEffects } from '@/app/effects/fileMappingEffects';
import { registerApiTokensEffects } from '@/app/effects/apiTokensEffects';
import { registerUserSettingsEffects } from '@/app/effects/userSettingsEffects';
import { registerProfileEffects } from '@/app/effects/profileEffects';
import { registerGitOpsLogEffects } from '@/app/effects/gitOpsLogEffects';

// Register API services
apiRegistry.register(AccountsApiService);
apiRegistry.register(SpacesApiService);
apiRegistry.register(EnrichmentsApiService);
apiRegistry.register(DraftChangesApiService);
apiRegistry.register(UserBranchApiService);
apiRegistry.register(FileMappingApiService);
apiRegistry.register(ApiTokensApiService);
apiRegistry.register(ServiceTokensApiService);
apiRegistry.register(UserSettingsApiService);
apiRegistry.register(GitOpsLogApiService);

// Initialize API services
apiRegistry.initialize({});

// Register auth plugins globally
apiRegistry.plugins.add(RestProtocol, new AuthPlugin());
apiRegistry.plugins.add(RestProtocol, new CsrfPlugin());
apiRegistry.plugins.add(RestProtocol, new PerformancePlugin());

// Create HAI3 app instance
const app = createHAI3App();

// Register app-level effects
registerBootstrapEffects(app.store.dispatch);
registerWikiEffects();
registerEnrichmentEffects();
registerDraftChangeEffects();
registerUserBranchEffects();
registerFileMappingEffects();
registerApiTokensEffects();
registerUserSettingsEffects();
registerProfileEffects();
registerGitOpsLogEffects();

export { app };
