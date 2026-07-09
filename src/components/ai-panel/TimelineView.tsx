import ReactMarkdown from 'react-markdown';
import type { AssistantTimeline } from './timeline';
import { ToolEntry } from './ToolEntry';

export function TimelineView({ timeline }: { timeline: AssistantTimeline }) {
  return (
    <>
      {timeline.segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return (
            <div key={i} className="autonnel-puck-ai-panel__markdown">
              <ReactMarkdown>{seg.text}</ReactMarkdown>
            </div>
          );
        }
        return <ToolEntry key={i} segment={seg} />;
      })}
    </>
  );
}
