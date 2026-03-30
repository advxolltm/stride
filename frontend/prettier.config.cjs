module.exports = {
  plugins: ["prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: ["*.tsx", "*.jsx", "*.ts", "*.js"],
      options: {
        tabWidth: 4,
        singleQuote: true,
        semi: false,
      },
    },
  ],
};
