module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['repo', 'web', 'ui', 'convex', 'custom-backend', 'docs']
    ],
    'scope-empty': [1, 'never']
  }
};