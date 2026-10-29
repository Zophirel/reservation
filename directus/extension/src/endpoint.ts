import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint({
	id: 'sql-console',
	handler: (router, { database }) => {
		router.get('/tables', async (req, res, next) => {
			if (!req.accountability?.admin) {
				res.status(403).json({ error: 'Solo gli amministratori possono consultare lo schema SQL.' });
				return;
			}
			try {
				const result = await database('information_schema.tables')
					.select('table_name')
					.where({ table_schema: 'public', table_type: 'BASE TABLE' })
					.whereNotLike('table_name', 'directus\\_%')
					.orderBy('table_name');
				res.json({ tables: result.map(({ table_name }) => table_name) });
			} catch (error) {
				next(error);
			}
		});

		router.post('/execute', async (req, res, next) => {
			if (!req.accountability?.admin) {
				res.status(403).json({ error: 'Solo gli amministratori possono eseguire SQL.' });
				return;
			}

			const query = req.body?.query;
			if (typeof query !== 'string' || !query.trim() || query.length > 100_000) {
				res.status(400).json({ error: 'Inserisci uno script SQL valido (massimo 100 KB).' });
				return;
			}

			try {
				const result = await database.raw(query);
				res.json({ rows: result.rows ?? [], rowCount: result.rowCount ?? 0 });
			} catch (error) {
				next(error);
			}
		});
	},
});
