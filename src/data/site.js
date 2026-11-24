import content from './content.json';

// Screenshots are files in src/assets/screens; content.json names them and Vite supplies the URLs.
const files = import.meta.glob('../assets/screens/*', { eager: true, import: 'default' });

export default {
  ...content,
  projects: content.projects.map((pr) => ({
    ...pr,
    images: pr.images.map((im) => ({ ...im, src: files['../assets/screens/' + im.src] || '' })),
  })),
};
