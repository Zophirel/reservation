import { defineModule } from '@directus/extensions-sdk';
import Page from './page.vue';

export default defineModule({
	id: 'sql-console-ui',
	name: 'SQL Scripts',
	icon: 'terminal',
	routes: [{ path: '', component: Page }],
});
