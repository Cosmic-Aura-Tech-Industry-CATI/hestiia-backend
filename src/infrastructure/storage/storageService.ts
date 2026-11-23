export const storageService = {
  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  },
};
