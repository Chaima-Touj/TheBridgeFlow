import { createElement } from "react";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export const newsMarkdownOptions = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeSanitize],
  components: {
    h1: ({ children }) => createElement("h2", null, children),
    a: ({ children, ...props }) => {
      const anchorProps = { ...props };
      delete anchorProps.node;
      return createElement(
        "a",
        { ...anchorProps, rel: "nofollow noopener noreferrer" },
        children,
      );
    },
  },
};
