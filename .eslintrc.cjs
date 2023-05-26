module.exports = {
	extends: '@blake.regalia/eslint-config-elite/svelte.js',
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
		tsconfigRootDir: __dirname,
		project: 'tsconfig.json',
	},
	globals: {
		'destructureImportedNfpModule': 'readonly',
	},
};
