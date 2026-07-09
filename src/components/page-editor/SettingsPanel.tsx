import { Button as DsButton } from '../primitives/ds';
import { Input, Textarea, dsFieldLabelClass, dsFieldHintClass, dsFieldErrorTextClass } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { SettingsPanelProps } from './types';

export function SettingsPanel(props: SettingsPanelProps) {
  const {
    pageName, setPageName, slug, setSlug, slugError, setSlugError,
    meta, setMeta, showCustomScripts, headContent, setHeadContent,
    bodyScripts, setBodyScripts, settingsSaveState, onSave,
  } = props;

  return (
    <div className="h-full overflow-auto bg-ds-app">
      <div className="px-5 py-4 flex flex-col gap-4">
        <div>
          <label className={dsFieldLabelClass}>Page name</label>
          <Input
            type="text"
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            placeholder="Enter page name..."
            className="w-full"
          />
          <p className={dsFieldHintClass}>Display name for this page in the admin panel.</p>
        </div>

        <div>
          <label className={dsFieldLabelClass}>Slug</label>
          <Input
            type="text"
            value={slug}
            onChange={(e) => {
              const val = e.target.value.toLowerCase();
              if (val === '/' || val === '') setSlug(val);
              else setSlug(val.replace(/[^a-z0-9-]/g, '-'));
              setSlugError('');
            }}
            placeholder="e.g. checkout, thank-you"
            className={cn('w-full', slugError && 'border-ds-bad focus:border-ds-bad focus:ring-ds-bad/25')}
          />
          {slugError && <p className={dsFieldErrorTextClass}>{slugError}</p>}
          <p className={dsFieldHintClass}>
            URL path for this page. Use "/" for homepage. Only lowercase letters, numbers and hyphens allowed.
          </p>
        </div>

        <div>
          <label className={dsFieldLabelClass}>Page title</label>
          <Input
            type="text"
            value={meta.title || ''}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            placeholder="Enter page title..."
            className="w-full"
          />
          <p className={dsFieldHintClass}>Displayed in browser tab and search results.</p>
        </div>

        <div>
          <label className={dsFieldLabelClass}>Meta description</label>
          <Textarea
            value={meta.description || ''}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            placeholder="Enter meta description for SEO..."
            rows={3}
            className="w-full resize-y"
          />
          <p className={dsFieldHintClass}>{(meta.description || '').length}/160 characters recommended.</p>
        </div>

        {showCustomScripts && (
          <>
            <div>
              <label className={dsFieldLabelClass}>Head scripts</label>
              <Textarea
                value={headContent}
                onChange={(e) => setHeadContent(e.target.value)}
                placeholder={'<script src="https://example.com/analytics.js"></script>\n<meta name="custom" content="value">'}
                rows={5}
                spellCheck={false}
                className="w-full resize-y font-ds-mono"
              />
              <p className={dsFieldHintClass}>
                Custom HTML injected into &lt;head&gt;. Useful for analytics, custom meta tags or external stylesheets.
              </p>
            </div>
            <div>
              <label className={dsFieldLabelClass}>Body end scripts</label>
              <Textarea
                value={bodyScripts}
                onChange={(e) => setBodyScripts(e.target.value)}
                placeholder={'<script>\n  // Custom JavaScript here\n  console.log("page loaded");\n</script>'}
                rows={5}
                spellCheck={false}
                className="w-full resize-y font-ds-mono"
              />
              <p className={dsFieldHintClass}>
                Custom scripts injected before &lt;/body&gt;. Runs after page content loads.
              </p>
            </div>
          </>
        )}

        <div className="flex justify-end pt-1">
          <DsButton
            variant="primary"
            onClick={onSave}
            disabled={settingsSaveState === 'saving'}
          >
            {settingsSaveState === 'saving' ? 'Saving...' : settingsSaveState === 'saved' ? 'Saved' : 'Save settings'}
          </DsButton>
        </div>
      </div>
    </div>
  );
}
