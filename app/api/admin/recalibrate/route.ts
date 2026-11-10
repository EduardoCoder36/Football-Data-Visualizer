import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');

  // Guard endpoint against unauthorized triggers
  if (!secret || secret !== process.env.ADMIN_TRIGGER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const repoOwner = process.env.GITHUB_REPO_OWNER;
  const repoName = process.env.GITHUB_REPO_NAME;
  const pat = process.env.GITHUB_DISPATCH_PAT;

  // If GitHub dispatch credentials are configured, trigger the remote workflow
  if (repoOwner && repoName && pat) {
    try {
      const ghResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/recalibrate.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${pat}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      if (!ghResponse.ok) {
        const errorText = await ghResponse.text();
        return NextResponse.json(
          {
            error: 'GitHub dispatch failed',
            details: errorText,
          },
          { status: ghResponse.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Recalibration dispatched successfully.',
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }

  // Fallback for local/self-hosted execution when GitHub PAT is not set
  try {
    await execFileAsync('npx', ['tsx', 'services/sync-worker/index.ts'], {
      cwd: process.cwd(),
      env: process.env,
    });
    return NextResponse.json({
      success: true,
      message: 'Local trajectory recalibration executed successfully.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Server missing GitHub dispatch credentials and local sync failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method GET Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
