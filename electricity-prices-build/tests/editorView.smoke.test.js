import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../src/services/layoutStorageService.js', () => ({
  listLayoutNames: vi.fn(async () => ['living-room']),
  saveNamedLayout: vi.fn(async (name) => name),
  loadNamedLayout: vi.fn(async () => ({
    v: 1,
    panel: 'table',
    source: 'upcoming',
    theme: 'dark',
    tz: 'Europe/Vilnius',
  })),
  deleteNamedLayout: vi.fn(async () => true),
}));

describe('EditorView smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('renders panel controls and saved layout list', async () => {
    const EditorView = (await import('../src/views/EditorView.vue')).default;
    const wrapper = mount(EditorView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
        mocks: { $t: (key) => key },
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain('editor.title');
    expect(wrapper.find('#editor-panel').exists()).toBe(true);
    expect(wrapper.find('#editor-saved option[value="living-room"]').exists()).toBe(true);
  });
});
