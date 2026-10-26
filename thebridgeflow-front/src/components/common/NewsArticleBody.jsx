import ReactMarkdown from "react-markdown";
import { newsMarkdownOptions } from "./newsMarkdown.js";
import "./NewsArticleBody.css";

export default function NewsArticleBody({ content, className = "" }) {
  if (!content?.trim()) return null;

  return (
    <div className={`news-markdown ${className}`.trim()}>
      <ReactMarkdown {...newsMarkdownOptions}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
