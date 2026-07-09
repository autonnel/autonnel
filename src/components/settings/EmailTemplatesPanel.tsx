import { Card as DsCard, Badge as DsBadge } from '../primitives/ds';

interface TemplateRow {
  type: string;
  name: string;
  subject?: string;
  isCustomized: boolean;
  isActive: boolean;
}

interface EmailTemplatesPanelProps {
  initialTemplates: TemplateRow[];
}

export default function EmailTemplatesPanel({ initialTemplates }: EmailTemplatesPanelProps) {
  const templates = initialTemplates;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        Transactional emails sent for orders, shipping, refunds, and abandoned-cart recall. Click Edit to customize the design and copy per language.
      </div>

      <DsCard padded={false}>
        {templates.length === 0 ? (
          <div className="px-6 py-16 text-center text-[13px] text-ds-muted">No templates available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-ds-surface2 border-b border-ds-line">
                <tr>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">
                    Subject
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right w-[80px]" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.type} className="hover:bg-ds-surface2 transition-colors">
                    <td className="px-4 py-3 text-[13px] text-ds-slate border-b border-[#F3F4F6] font-ds-mono">
                      {t.type}
                    </td>
                    <td className="px-4 py-3 text-[13.5px] text-ds-ink border-b border-[#F3F4F6]">{t.name}</td>
                    <td className="px-4 py-3 text-[13px] text-ds-muted border-b border-[#F3F4F6] truncate max-w-[320px]">
                      {t.subject || '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6]">
                      {t.isCustomized ? (
                        <DsBadge tone="ok">Customized</DsBadge>
                      ) : (
                        <DsBadge tone="muted">Default</DsBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6] text-right">
                      <a
                        href={`/settings/email-templates/${t.type}/en/edit`}
                        className="text-[12.5px] text-ds-accent hover:underline"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DsCard>
    </div>
  );
}
