import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const secret = req.headers.get('x-admin-secret');

    // Guard the endpoint against unauthorized requests
    if (!secret || secret !== process.env.ADMIN_TRIGGER_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;
    const pat = process.env.GITHUB_DISPATCH_PAT;

    if (!repoOwner || !repoName || !pat) {
        return NextResponse.json(
            { error: 'Server missing GitHub dispatch credentials' },
            { status: 500 }
        );
    }

    // Trigger the workflow_dispatch via GitHub REST API
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
            { error: 'GitHub dispatch failed', details: errorText },
            { status: ghResponse.status }
        );
    }

    return NextResponse.json({
        success: true,
        message: 'Recalibration dispatched successfully.',
    });
}