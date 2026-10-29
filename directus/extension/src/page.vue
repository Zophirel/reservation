<template>
	<private-view title="SQL Scripts">
		<template #navigation>
			<div class="history-nav">
				<div class="history-heading">
					<h2>Cronologia</h2>
					<button v-if="history.length" class="clear-history" type="button" title="Cancella cronologia" @click="clearHistory">Svuota</button>
				</div>
				<p v-if="!history.length" class="empty-history">Le query completate appariranno qui.</p>
				<button v-for="item in history" :key="item.id" class="history-item" type="button" @click="loadQuery(item.query)">
					<strong>{{ queryTitle(item.query) }}</strong>
					<small>{{ formatDate(item.createdAt) }}</small>
				</button>
			</div>
		</template>
		<div class="sql-console">
			<main class="workspace">
				<div class="warning">
					Gli script vengono eseguiti direttamente sul database dell’applicazione. Possono modificare o eliminare dati.
					Solo gli utenti amministratori possono eseguirli.
				</div>
				<label>Script SQL</label>
				<div ref="editorHost" class="editor-host" aria-label="Editor SQL"></div>
				<div class="actions">
					<button type="button" :disabled="running || !query.trim()" @click="execute">
						{{ running ? 'Esecuzione…' : 'Esegui script' }}
					</button>
				</div>
				<div v-if="error" class="error">{{ error }}</div>
				<div v-if="result" class="result">
					<p>{{ result.rowCount }} righe restituite o interessate.</p>
					<div v-if="result.rows.length" class="table-wrap">
						<table>
							<thead><tr><th v-for="column in columns" :key="column">{{ column }}</th></tr></thead>
							<tbody>
								<tr v-for="(row, rowIndex) in result.rows" :key="rowIndex">
									<td v-for="column in columns" :key="column">{{ formatCell(row[column]) }}</td>
								</tr>
							</tbody>
						</table>
					</div>
					<p v-else>Nessuna riga da visualizzare.</p>
				</div>
			</main>
		</div>
	</private-view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { basicSetup, EditorView } from 'codemirror';
import { closeBrackets } from '@codemirror/autocomplete';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { lintGutter, linter } from '@codemirror/lint';
import { parse as parsePostgres } from 'pgsql-ast-parser';
import { useApi } from '@directus/extensions-sdk';

const api = useApi();
const editorHost = ref<HTMLElement | null>(null);
const query = ref('');
const running = ref(false);
const error = ref('');
type HistoryItem = { id: string; query: string; createdAt: string };
const history = ref<HistoryItem[]>([]);
const historyKey = 'reservation-sql-console-history-v1';
type Row = Record<string, unknown>;
const result = ref<{ rows: Row[]; rowCount: number } | null>(null);
const columns = computed(() => result.value?.rows.length ? Object.keys(result.value.rows[0]) : []);
let editor: EditorView | null = null;

onMounted(async () => {
	try {
		history.value = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
	} catch {
		history.value = [];
	}
	let tables: string[] = [];
	try {
		const response = await api.get('/sql-console/tables');
		tables = response.data.tables ?? [];
	} catch {
		// The endpoint enforces admin access; SQL keywords remain available if it fails.
	}
	if (!editorHost.value) return;
	const schema = Object.fromEntries(tables.map((table) => [table, []]));
	editor = new EditorView({
		parent: editorHost.value,
		doc: query.value,
		extensions: [
			basicSetup,
			sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
			closeBrackets({ brackets: ['(', '[', '{', "'", '"'] }),
			lintGutter(),
			linter(async (view) => {
				const text = view.state.doc.toString();
				if (!text.trim()) return [];
				try {
					await parsePostgres(text);
					return [];
				} catch (cause: any) {
					const errorOffset = Number(cause?.location?.start?.offset);
					const from = Number.isFinite(errorOffset)
						? Math.max(0, Math.min(text.length, errorOffset))
						: Math.max(0, text.length - 1);
					return [{
						from,
						to: Math.min(text.length, from + 1),
						severity: 'error',
						message: cause?.message ?? 'Errore di sintassi PostgreSQL',
						source: 'SQL lint',
					}];
				}
			}, { delay: 600 }),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) query.value = update.state.doc.toString();
			}),
		],
	});
});

onUnmounted(() => editor?.destroy());

async function execute() {
	if (!window.confirm('Eseguire questo script direttamente sul database?')) return;
	running.value = true;
	error.value = '';
	result.value = null;
	try {
		const response = await api.post('/sql-console/execute', { query: query.value });
		result.value = response.data;
		addToHistory(query.value);
	} catch (cause: any) {
		error.value = cause?.response?.data?.errors?.[0]?.message ?? cause?.response?.data?.error ?? 'Errore durante l’esecuzione dello script.';
	} finally {
		running.value = false;
	}
}

function addToHistory(sqlText: string) {
	const item: HistoryItem = { id: crypto.randomUUID(), query: sqlText, createdAt: new Date().toISOString() };
	history.value = [item, ...history.value].slice(0, 50);
	persistHistory();
}

function persistHistory() {
	try {
		localStorage.setItem(historyKey, JSON.stringify(history.value));
	} catch {
		// The current in-memory history still works if browser storage is unavailable.
	}
}

function clearHistory() {
	history.value = [];
	persistHistory();
}

function loadQuery(sqlText: string) {
	query.value = sqlText;
	result.value = null;
	error.value = '';
	if (!editor) return;
	editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: sqlText } });
	editor.focus();
}

function queryTitle(sqlText: string) {
	return sqlText.trim().split(/\r?\n/)[0].slice(0, 90) || 'Query vuota';
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatCell(value: unknown) {
	if (value === null || value === undefined) return '—';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}
</script>

<style scoped>
.sql-console { box-sizing: border-box; width: 100%; min-width: 0; height: 100%; margin: 0; }
.history-nav { box-sizing: border-box; width: 100%; padding: 12px; }
.history-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 8px 12px; }
.history-heading h2 { margin: 0; font-size: 14px; font-weight: 700; }
.clear-history { border: 0; color: var(--theme--foreground-subdued); background: transparent; cursor: pointer; }
.empty-history { margin: 8px; color: var(--theme--foreground-subdued); font-size: 13px; }
.history-item { display: grid; width: 100%; gap: 5px; margin: 3px 0; padding: 10px 8px; border: 0; border-radius: 5px; color: var(--theme--foreground); background: transparent; text-align: left; cursor: pointer; }
.history-item:hover { background: var(--theme--background-subdued); }
.history-item strong { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.history-item small { color: var(--theme--foreground-subdued); font-size: 11px; }
.workspace { box-sizing: border-box; width: 100%; min-width: 0; overflow: auto; padding: 24px; display: grid; align-content: start; gap: 20px; }
.warning, .error { padding: 14px 16px; border-radius: 6px; }
.warning { color: var(--theme--foreground); background: var(--theme--warning-background, #fff3cd); }
.error { color: var(--theme--danger); background: var(--theme--danger-background, #fce8e6); }
label { font-weight: 600; }
.editor-host { min-width: 0; overflow: hidden; border: 1px solid var(--theme--border-color); border-radius: 6px; }
.editor-host :deep(.cm-editor) { min-width: 0; min-height: 280px; color: var(--theme--foreground); background: var(--theme--background); font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.editor-host :deep(.cm-scroller) { overflow: auto; }
.actions { display: flex; justify-content: flex-end; }
.actions button { padding: 10px 16px; border: 0; border-radius: 6px; color: #fff; background: var(--theme--primary); cursor: pointer; }
.actions button:disabled { opacity: .55; cursor: not-allowed; }
.result { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; }
.table-wrap { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; overflow-x: auto; overflow-y: auto; border: 1px solid var(--theme--border-color); border-radius: 6px; }
table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 9px 12px; border-bottom: 1px solid var(--theme--border-color); text-align: left; white-space: nowrap; }
th { position: sticky; top: 0; background: var(--theme--background-subdued); }
@media (max-width: 760px) {
	.workspace { padding: 18px; }
}
</style>
