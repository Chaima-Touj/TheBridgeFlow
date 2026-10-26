import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import "./NewsArticleBody.css";

const components = {
  h1: ({ children }) => <h2>{children}</h2>,
  a: ({ children, ...props }) => <a {...props} rel="nofollow noopener noreferrer">{children}</a>,
};

export default function NewsArticleBody({ content, className = "" }) {
  if (!content?.trim()) return null;

  return (
    <div className={`news-markdown ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
