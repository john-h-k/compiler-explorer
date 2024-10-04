// Copyright (c) 2024, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import crypto from 'crypto';

import {ExecutionParams} from '../../types/compilation/compilation.interfaces.js';
import {BasicExecutionResult, ExecutableExecutionOptions} from '../../types/execution/execution.interfaces.js';
import {CompilationEnvironment} from '../compilation-env.js';
import {logger} from '../logger.js';

import {BaseExecutionTriple} from './base-execution-triple.js';
import {EventsWsWaiter} from './events-websocket.js';
import {IExecutionEnvironment} from './execution-env.interfaces.js';
import {SqsExecuteRequester} from './sqs-execution-queue.js';

export class RemoteExecutionEnvironment implements IExecutionEnvironment {
    private packageHash: string;
    private triple: BaseExecutionTriple;
    private execQueue: SqsExecuteRequester;
    private guid: string;
    private environment: CompilationEnvironment;

    constructor(environment: CompilationEnvironment, triple: BaseExecutionTriple, executablePackageHash: string) {
        this.environment = environment;
        this.triple = triple;
        this.guid = crypto.randomUUID();
        this.packageHash = executablePackageHash;
        this.execQueue = new SqsExecuteRequester(environment.ceProps, environment.awsProps);

        logger.info(
            `RemoteExecutionEnvironment with ${triple.toString()} and ${executablePackageHash} - guid ${this.guid}`,
        );
    }

    async downloadExecutablePackage(hash: string): Promise<void> {
        throw new Error('Method not implemented.');
    }

    private async queueRemoteExecution(params: ExecutionParams) {
        await this.execQueue.push(this.triple, {
            guid: this.guid,
            hash: this.packageHash,
            params: params,
        });
    }

    async execute(params: ExecutionParams): Promise<BasicExecutionResult> {
        const waiter = new EventsWsWaiter(this.environment.ceProps);
        try {
            await waiter.subscribe(this.guid);

            await this.queueRemoteExecution(params);

            const result = await waiter.data();
            await waiter.close();

            return result;
        } catch (e) {
            waiter.close();
            logger.error(e);
            throw e;
        }
    }

    async execBinary(
        executable: string,
        executeParameters: ExecutableExecutionOptions,
        homeDir: string,
        extraConfiguration?: any,
    ): Promise<BasicExecutionResult> {
        throw new Error('Method not implemented.');
    }
}
