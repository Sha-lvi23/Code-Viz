const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const unzipper = require('unzipper');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const app = express();
const port = 5000;


app.use(cors());
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const upload = multer({ dest: uploadsDir });



function findFilesByExt(dirPath, extensions) {
    let files = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') {
                files = files.concat(findFilesByExt(fullPath, extensions));
            }
        } else if (extensions.includes(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
}

function getFileDependencies(filePath) {
    const dependencies = new Set();
    try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const ast = babelParser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
        traverse(ast, {
            ImportDeclaration(path) {
                dependencies.add(path.node.source.value);
            },
        });
    } catch (error) {
        
    }
    return Array.from(dependencies);
}

function detectCycles(dependencyMap) {
    const visiting = new Set();
    const visited = new Set();
    const cycles = new Set();

    function dfs(node) {
        visiting.add(node);
        visited.add(node);
        const neighbors = dependencyMap[node] || [];
        for (const neighbor of neighbors) {
            if (!dependencyMap[neighbor]) continue;
            if (visiting.has(neighbor)) {
                cycles.add(neighbor);
                cycles.add(node);
            }
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            }
        }
        visiting.delete(node);
    }

    for (const node in dependencyMap) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }
    return cycles;
}



app.post('/api/visualize', upload.single('projectZip'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const zipPath = req.file.path;
    const extractPath = path.join(__dirname, 'extracted', req.file.filename);

    try {
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .promise();

        const extensions = ['.js', '.jsx', 'ts', '.tsx'];
        const projectFiles = findFilesByExt(extractPath, extensions);

        const dependencyMap = {};
        const dependentsMap = {}; 

        projectFiles.forEach(file => {
            const relativePath = path.relative(extractPath, file).replace(/\\/g, '/');
            dependencyMap[relativePath] = [];
            dependentsMap[relativePath] = []; 
        });

        for (const file of projectFiles) {
            const relativePath = path.relative(extractPath, file).replace(/\\/g, '/');
            const dependencies = getFileDependencies(file);

            for (const dep of dependencies) {
                if (dep.startsWith('.')) {
                    let resolvedPath = path.join(path.dirname(relativePath), dep).replace(/\\/g, '/');
                    let matchingFile = null;
                    
                  
                    const potentialPaths = [
                        resolvedPath,
                        `${resolvedPath}.js`,
                        `${resolvedPath}.jsx`,
                        `${resolvedPath}.ts`,
                        `${resolvedPath}.tsx`,
                        path.join(resolvedPath, 'index.js'),
                        path.join(resolvedPath, 'index.jsx'),
                        path.join(resolvedPath, 'index.ts'),
                        path.join(resolvedPath, 'index.tsx'),
                    ];

                    for (const p of potentialPaths) {
                        if (dependencyMap[p] !== undefined) {
                            matchingFile = p;
                            break;
                        }
                    }

                    if (matchingFile) {
                        dependencyMap[relativePath].push(matchingFile);
                        
                        if (dependentsMap[matchingFile]) {
                            dependentsMap[matchingFile].push(relativePath);
                        }
                    }
                }
            }
        }

        const nodesInCycle = detectCycles(dependencyMap);

        const nodes = [];
        const edges = [];
        let i = 0;
        for (const file in dependencyMap) {
            nodes.push({
                id: file,
                data: {
                    label: path.basename(file),
                    
                    dependencies: dependencyMap[file],
                    dependents: dependentsMap[file],
                },
                position: { x: (i % 6) * 180, y: Math.floor(i / 6) * 100 },
                className: nodesInCycle.has(file) ? 'cycle-node' : '',
            });
            i++;

            for (const dep of dependencyMap[file]) {
                edges.push({
                    id: `e-${file}-${dep}`,
                    source: file,
                    target: dep,
                    animated: nodesInCycle.has(file) && nodesInCycle.has(dep),
                });
            }
        }

        res.json({
            message: `Project analyzed successfully. Found ${Object.keys(dependencyMap).length} files.`,
            nodes: nodes,
            edges: edges,
        });

    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: 'Failed to process the zip file.' });
    } finally {
        fs.unlinkSync(zipPath);
        fs.rmSync(extractPath, { recursive: true, force: true });
    }
});



app.listen(port, () => {
    console.log(`CodeViz backend server listening at http://localhost:${port}`);
});
