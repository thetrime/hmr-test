const path = require('path');
const fs = require('fs');
const os = require('os');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

module.exports = {
    mode: "development",
    entry: './src/index.js',
    externals: {
        "react": "React",
        "react-dom": "ReactDOM"
    },
    devServer: {
        open: true,
        contentBase: './dist',
        port: 3000,
        hotOnly: true,
        disableHostCheck: true,
        openPage: `http://${os.hostname()}:3000`
    },

    module: {
        rules: [
            {
                test: /\.(js|jsx|mjs)$/,
                exclude: /node_modules/,
                include: resolveApp('src'),
                loader: require.resolve('babel-loader'),
                options: {
                    compact: true,
                    presets: ["@babel/preset-react"],
                    plugins: [require.resolve('react-refresh/babel')]
                }
            }
        ]
    },

    plugins: [
        new ReactRefreshPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin(),
    ],
    resolve: {
        extensions: ['.js', '.jsx'],
    },
};
