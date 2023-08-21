import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

import * as exec from '@actions/exec';

import {buildExec} from './buildExec';
import {
  getBaseUrl,
  getPlatform,
  getUploaderName,
  setFailure,
} from './helpers';

import verify from './validate';
import versionInfo from './version';

let failCi;

/**
 * Main function of the codecov-action
 */
async function run(): Promise<void> {
  try {
    const opts = await buildExec();
    const platform = getPlatform(opts.os);

    const filename = path.join( __dirname, getUploaderName(platform));
    https.get(getBaseUrl(platform, opts.uploaderVersion), (res) => {
    // Image will be stored at this path
      const filePath = fs.createWriteStream(filename);
      res.pipe(filePath);
      filePath
          .on('error', (err) => {
            setFailure(
                `Codecov: Failed to write uploader binary: ${err.message}`,
                true,
            );
          }).on('finish', async () => {
            filePath.close();

            await verify(
                filename,
                platform,
                opts.uploaderVersion,
                opts.verbose,
                failCi);
            await versionInfo(platform, opts.uploaderVersion);
            await fs.chmodSync(filename, '777');

            const unlink = () => {
              fs.unlink(filename, (err) => {
                if (err) {
                  setFailure(
                      `Codecov: Could not unlink uploader: ${err.message}`,
                      failCi,
                  );
                }
              });
            };
            await exec.exec(filename, opts.execArgs, opts.options)
                .catch((err) => {
                  setFailure(
                      `Codecov: Failed to properly upload: ${err.message}`,
                      failCi,
                  );
                }).then(() => {
                  unlink();
                });
          });
    });
  } catch (err) {
    setFailure(
        `Codecov: Encountered an unexpected error ${err.message}`,
        failCi);
  }
}

run();
