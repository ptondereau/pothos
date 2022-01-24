import fs from 'fs';
import { join, relative, resolve } from 'path';
import matter, { GrayMatterFile } from 'gray-matter';
import { TableOfContents, TableOfContentsEntry } from '../components/Toc';

const navOrder: Record<string, string[]> = {
  '@root': ['Docs', 'Guide', 'Plugins', 'Migrations', 'Design', 'API'],
  Guide: [
    'Objects',
    'SchemaBuilder',
    'Args',
    'Fields',
    'Context',
    'Input Objects',
    'Enums',
    'Scalars',
    'Interfaces',
    'Unions',
    'Using plugins',
    'App Layout',
    'Generating client types',
    'Patterns',
    'Printing Schemas',
    'Changing default nullability',
    'Writing plugins',
    'Deno',
    'Troubleshooting',
  ],
};

export function loadMDXFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) =>
    // eslint-disable-next-line no-nested-ternary
    entry.isDirectory()
      ? loadMDXFiles(join(dir, entry.name))
      : entry.name.endsWith('.mdx')
      ? join(dir, entry.name)
      : [],
  );
}

export type MDXFile = GrayMatterFile<string> & {
  path: string;
  menu?: string;
  name: string;
  description: string;
  link: string;
};
let cachedFiles: MDXFile[];

const pagesDir = resolve(process.cwd(), 'pages');

export function loadDocsFiles() {
  if (cachedFiles) {
    return cachedFiles;
  }

  cachedFiles = loadMDXFiles(pagesDir).map((entry) => {
    const matterFile = matter(fs.readFileSync(entry));
    const { menu, title, link, description } = matterFile.data as {
      menu?: string;
      title: string;
      link?: string;
      description?: string;
    };

    return {
      ...matterFile,
      path: entry,
      menu,
      name: title,
      description: description ?? '',
      link: link ?? toLink(entry),
    };
  });

  return cachedFiles;
}

export function buildNav(): TableOfContents {
  const entries = loadDocsFiles();

  const nav: TableOfContents = {
    entries: [],
  };

  // Sort to ensure menu entries are added to nav first
  const sorted = [...entries].sort((a, b) => (a.data.menu ? 1 : -1));

  sorted.forEach(({ path, data, menu, name, link }) => {
    if (!menu) {
      nav.entries.push({
        name,
        link,
      });
    } else {
      const menuEntry = nav.entries.find((entry) => entry.name === menu);

      if (!menuEntry) {
        throw new Error(`Missing menu ${menu} (referenced in ${path})`);
      }

      if (!menuEntry?.children) {
        menuEntry.children = [];
      }

      menuEntry?.children.push({
        name,
        link,
      });
    }
  });

  nav.entries.forEach((entry) => {
    if (entry.children) {
      sortWithList(entry.children, navOrder[entry.name] ?? []);
    }
  });
  sortWithList(nav.entries, navOrder['@root']);

  return nav;
}

function sortWithList(list: TableOfContentsEntry[], order: string[]) {
  list.sort((a, b) => {
    const indexA = order.indexOf(a.name);
    const indexB = order.indexOf(b.name);

    if (indexA !== -1) {
      if (indexB !== -1) {
        return indexA < indexB ? -1 : 1;
      }

      return -1;
    }

    if (indexB !== -1) {
      return 1;
    }

    return a.name < b.name ? -1 : 1;
  });
}

export function toLink(file: string) {
  return `/${relative(pagesDir, file).replace(/(\/index)?\.mdx?$/, '')}`;
}
