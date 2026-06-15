<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  defaultLayoutConfig,
  normalizeLayoutConfig,
  buildDisplayUrl,
  buildShareUrl,
  exportLayoutJson,
  importLayoutJson,
} from '../lib/layoutCodec.js';
import {
  listLayoutNames,
  saveNamedLayout,
  loadNamedLayout,
  deleteNamedLayout,
} from '../services/layoutStorageService.js';

const draft = ref({ ...defaultLayoutConfig() });
const layoutName = ref('');
const savedNames = ref([]);
const selectedName = ref('');
const importText = ref('');
const statusMessage = ref('');
const statusError = ref(false);

const previewPath = computed(() => buildDisplayUrl(draft.value));
const previewUrl = computed(() => buildShareUrl(draft.value));

async function refreshNames() {
  savedNames.value = await listLayoutNames();
}

function setStatus(message, isError = false) {
  statusMessage.value = message;
  statusError.value = isError;
}

async function handleSave() {
  try {
    const normalized = normalizeLayoutConfig(draft.value);
    if (!normalized) {
      setStatus('editor.statusInvalid', true);
      return;
    }
    const name = await saveNamedLayout(layoutName.value, normalized);
    selectedName.value = name;
    await refreshNames();
    setStatus('editor.statusSaved');
  } catch {
    setStatus('editor.statusSaveFailed', true);
  }
}

async function handleLoad() {
  if (!selectedName.value) return;
  const config = await loadNamedLayout(selectedName.value);
  if (!config) {
    setStatus('editor.statusLoadFailed', true);
    return;
  }
  draft.value = { ...config };
  layoutName.value = selectedName.value;
  setStatus('editor.statusLoaded');
}

async function handleDelete() {
  if (!selectedName.value) return;
  await deleteNamedLayout(selectedName.value);
  if (layoutName.value === selectedName.value) {
    layoutName.value = '';
  }
  selectedName.value = '';
  await refreshNames();
  setStatus('editor.statusDeleted');
}

function handleExport() {
  try {
    importText.value = exportLayoutJson(draft.value);
    setStatus('editor.statusExported');
  } catch {
    setStatus('editor.statusInvalid', true);
  }
}

function handleImport() {
  const result = importLayoutJson(importText.value);
  if (!result.ok) {
    setStatus('editor.statusImportFailed', true);
    return;
  }
  draft.value = { ...result.config };
  setStatus('editor.statusImported');
}

async function copyPreviewLink() {
  try {
    await navigator.clipboard.writeText(previewUrl.value);
    setStatus('editor.statusCopied');
  } catch {
    setStatus('editor.copyFailed', true);
  }
}

onMounted(() => {
  refreshNames().catch(() => {
    setStatus('editor.statusLoadFailed', true);
  });
});
</script>

<template>
  <div class="editor-view container py-3">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="mb-0">{{ $t('editor.title') }}</h1>
      <RouterLink to="/settings" class="btn btn-outline-secondary btn-sm">
        {{ $t('nav.settings') }}
      </RouterLink>
    </div>

    <p class="text-muted">{{ $t('editor.intro') }}</p>

    <div class="card mb-3">
      <div class="card-body">
        <h2 class="h5">{{ $t('editor.panelTitle') }}</h2>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" for="editor-panel">{{ $t('editor.panelLabel') }}</label>
            <select id="editor-panel" v-model="draft.panel" class="form-select">
              <option value="chart">{{ $t('editor.panelChart') }}</option>
              <option value="table">{{ $t('editor.panelTable') }}</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="editor-source">{{ $t('editor.sourceLabel') }}</label>
            <select id="editor-source" v-model="draft.source" class="form-select">
              <option value="upcoming">{{ $t('editor.sourceUpcoming') }}</option>
              <option value="today">{{ $t('editor.sourceToday') }}</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="editor-theme">{{ $t('editor.themeLabel') }}</label>
            <select id="editor-theme" v-model="draft.theme" class="form-select">
              <option value="dark">{{ $t('editor.themeDark') }}</option>
              <option value="light">{{ $t('editor.themeLight') }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h2 class="h5">{{ $t('editor.saveTitle') }}</h2>
        <div class="row g-2 align-items-end">
          <div class="col-md-6">
            <label class="form-label" for="editor-name">{{ $t('editor.nameLabel') }}</label>
            <input id="editor-name" v-model="layoutName" type="text" class="form-control" />
          </div>
          <div class="col-md-6 d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-primary" @click="handleSave">
              {{ $t('editor.save') }}
            </button>
            <button type="button" class="btn btn-outline-primary" :disabled="!selectedName" @click="handleLoad">
              {{ $t('editor.load') }}
            </button>
            <button type="button" class="btn btn-outline-danger" :disabled="!selectedName" @click="handleDelete">
              {{ $t('editor.delete') }}
            </button>
          </div>
        </div>
        <div class="mt-3">
          <label class="form-label" for="editor-saved">{{ $t('editor.savedLabel') }}</label>
          <select id="editor-saved" v-model="selectedName" class="form-select">
            <option value="">{{ $t('editor.savedPlaceholder') }}</option>
            <option v-for="name in savedNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h2 class="h5">{{ $t('editor.shareTitle') }}</h2>
        <p class="mb-2"><code>{{ previewPath }}</code></p>
        <div class="d-flex gap-2 flex-wrap">
          <RouterLink :to="previewPath" class="btn btn-success">
            {{ $t('editor.preview') }}
          </RouterLink>
          <button type="button" class="btn btn-outline-success" @click="copyPreviewLink">
            {{ $t('display.copyLink') }}
          </button>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h2 class="h5">{{ $t('editor.importExportTitle') }}</h2>
        <textarea
          v-model="importText"
          class="form-control font-monospace mb-2"
          rows="6"
          :placeholder="$t('editor.importPlaceholder')"
        />
        <div class="d-flex gap-2 flex-wrap">
          <button type="button" class="btn btn-outline-secondary" @click="handleExport">
            {{ $t('editor.export') }}
          </button>
          <button type="button" class="btn btn-outline-secondary" @click="handleImport">
            {{ $t('editor.import') }}
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="statusMessage"
      class="editor-view__status"
      :class="{ 'text-danger': statusError, 'text-success': !statusError }"
      role="status"
    >
      {{ $t(statusMessage) }}
    </p>
  </div>
</template>

<style scoped>
.editor-view__status {
  font-weight: 500;
}
</style>
