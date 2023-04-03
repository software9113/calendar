import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import {
    KanbanColumnType,
    VerbalException,
    VerbalSuccess,
} from 'src/commons/enums/variable.enum';
import { KanbanService } from '../kanban/kanban.service';
import { UserFilesService } from '../user-files/user-files.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { PassTaskInfoDto } from './dtos/createTask.dto';
import { SubTasks } from './dtos/subTask.dto';
import { TaskDto } from './dtos/task.dto';
import { TaskRepository } from './task.repository';

const mongoose = require('mongoose');

@Injectable()
export class TaskService {
    constructor(
        private readonly taskRepository: TaskRepository,
        private readonly workspaceService: WorkspaceService,
        private readonly kanbanService: KanbanService,
        private readonly userFilesService: UserFilesService,
    ) {}

    async getAllTaskByWorkspaceId(userId: ObjectId, workspaceId: ObjectId) {
        const taskList = await this.listAllTaskByWorkspaceId(
            userId,
            workspaceId,
        );

        return { statusCode: HttpStatus.OK, data: taskList };
    }

    async listAllTaskByWorkspaceId(userId: ObjectId, workspaceId: ObjectId) {
        const taskList = await this.taskRepository.findByConditions(
            {
                user_id: userId,
                workspace_id: workspaceId,
            },
            null,
            null,
            null,
            'workspace_id kanban_column_id',
        );

        return taskList;
    }

    async getMultipleWorkspaceTask(userId: ObjectId, queryString: string) {
        const multipleWorkspaceTasks = await this.listMultipleWorkspaceTask(
            userId,
            queryString,
        );
        return { statusCode: HttpStatus.OK, data: multipleWorkspaceTasks };
    }

    async listMultipleWorkspaceTask(userId: ObjectId, queryString: string) {
        const queryList = queryString.split(',');
        const validateMongoRegExp = new RegExp('^[0-9a-fA-F]{24}$');
        for (const workspaceId of queryList) {
            if (!validateMongoRegExp.test(workspaceId)) {
                throw new HttpException(
                    VerbalException.MONGO_ID_NOT_VALID,
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }

        const listWorkspaceId = queryList.filter(onlyUnique);

        let tasks = [];
        for (const workspaceId of listWorkspaceId) {
            const wsId = mongoose.mongo.ObjectId(workspaceId);
            await this.workspaceService.listOneWorkspace(userId, wsId);

            const task = await this.listAllTaskByWorkspaceId(userId, wsId);

            tasks = tasks.concat(task);
        }
        return tasks;
    }

    async getAllTaskByTypeMultipleWorkspace(
        userId: ObjectId,
        queryString: string,
    ) {
        const taskList = await this.listAllTaskByTypeMultipleWorkspace(
            userId,
            queryString,
        );

        return { statusCode: HttpStatus.OK, data: taskList };
    }

    async listAllTaskByTypeMultipleWorkspace(
        userId: ObjectId,
        queryString: string,
    ) {
        const queryList = queryString.split(',');
        const validateMongoRegExp = new RegExp('^[0-9a-fA-F]{24}$');
        for (const workspaceId of queryList) {
            if (!validateMongoRegExp.test(workspaceId)) {
                throw new HttpException(
                    VerbalException.MONGO_ID_NOT_VALID,
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }

        const listWorkspaceId = queryList.filter(onlyUnique);

        // define template
        const templateInit = {
            kanban_column_name: 'OPEN',
            color_code: 'A2E0E7',
            type: KanbanColumnType.OPEN,
        };
        const templateInProgress = {
            kanban_column_name: 'IN PROGRESS',
            color_code: '16B1C3',
            type: KanbanColumnType.IN_PROGRESS,
        };
        const templateReview = {
            kanban_column_name: 'REVIEW',
            color_code: 'FFB300',
            type: KanbanColumnType.REVIEW,
        };
        const templateDone = {
            kanban_column_name: 'DONE',
            color_code: '9CABB8',
            type: KanbanColumnType.DONE,
        };

        const templates = [
            templateInit,
            templateInProgress,
            templateReview,
            templateDone,
        ];

        let respData = [];

        let listOfIds = [];
        for (const workspaceId of listWorkspaceId) {
            const wsId = mongoose.mongo.ObjectId(workspaceId);
            listOfIds.push(wsId);
        }
        for (const template of templates) {
            const kanbanColumns =
                await this.kanbanService.listMultipleWorkspaceKanbanColumnByType(
                    userId,
                    listOfIds,
                    template.type,
                );

            let taskListGlobal = [];

            for (const kanbanColumn of kanbanColumns) {
                const taskList = await this.listAllTaskInKanbanColumn(
                    userId,
                    kanbanColumn._id,
                    'workspace_id',
                );
                taskListGlobal = [...taskListGlobal, ...taskList];
            }

            respData.push({
                kanban_column: {
                    type: template.type,
                    kanban_column_name: template.kanban_column_name,
                    color_code: template.color_code,
                },
                tasks: taskListGlobal,
            });
        }

        return respData;
    }

    async getAllTaskByType(userId: ObjectId, workspaceId: ObjectId) {
        const taskList = await this.listAllTaskByType(userId, workspaceId);

        return { statusCode: HttpStatus.OK, data: taskList };
    }

    async listAllTaskByType(userId: ObjectId, workspaceId: ObjectId) {
        const kanbanColumns = await this.kanbanService.listAllKanbanColumn(
            userId,
            workspaceId,
        );

        let data = [];
        for (const kanbanColumn of kanbanColumns) {
            const taskList = await this.listAllTaskInKanbanColumn(
                userId,
                kanbanColumn._id,
                null,
            );

            data.push({
                // type_id: kanbanColumn.type,
                // type_name: KanbanColumnType[kanbanColumn.type],
                kanbanColumn: kanbanColumn,
                tasks: taskList,
            });
        }
        return data;
    }

    async getAllTaskByTypeMeWorkspace(userId: ObjectId) {
        // define template
        const templateInit = {
            kanban_column_name: 'OPEN',
            color_code: 'A2E0E7',
            type: KanbanColumnType.OPEN,
        };
        const templateInProgress = {
            kanban_column_name: 'IN PROGRESS',
            color_code: '16B1C3',
            type: KanbanColumnType.IN_PROGRESS,
        };
        const templateReview = {
            kanban_column_name: 'REVIEW',
            color_code: 'FFB300',
            type: KanbanColumnType.REVIEW,
        };
        const templateDone = {
            kanban_column_name: 'DONE',
            color_code: '9CABB8',
            type: KanbanColumnType.DONE,
        };

        const templates = [
            templateInit,
            templateInProgress,
            templateReview,
            templateDone,
        ];

        let respData = [];
        for (const template of templates) {
            const kanbanColumns =
                await this.kanbanService.listAllKanbanColumnByType(
                    userId,
                    template.type,
                );

            let taskListGlobal = [];

            for (const kanbanColumn of kanbanColumns) {
                const taskList = await this.listAllTaskInKanbanColumn(
                    userId,
                    kanbanColumn._id,
                    'workspace_id',
                );
                taskListGlobal = [...taskListGlobal, ...taskList];
            }

            respData.push({
                kanbanColumn: {
                    type: template.type,
                    kanban_column_name: template.kanban_column_name,
                    color_code: template.color_code,
                },
                tasks: taskListGlobal,
            });
        }

        return respData;
    }

    async getAllTaskPagination(
        userId: ObjectId,
        pageNumber: number,
        pageSize: number,
    ) {
        if (pageNumber < 1 || pageSize < 1) {
            throw new HttpException(
                VerbalException.INVALID_PAGE_NUMBER_OR_PAGE_SIZE,
                HttpStatus.BAD_REQUEST,
            );
        }

        if (pageSize > 100) {
            pageSize = 100;
        }

        const totalPageSize = await this.countTask(userId);

        const paginationInformation = {
            page: pageNumber / 1,
            size_each_page: pageSize / 1,
            max_number_of_page: Math.ceil(totalPageSize / pageSize),
        };

        return {
            statusCode: HttpStatus.OK,
            data: await this.listAllTaskPagination(
                userId,
                pageNumber,
                pageSize,
            ),
            pagination: paginationInformation,
        };
    }

    async listAllTaskPagination(
        userId: ObjectId,
        pageNumber: number,
        pageSize: number,
    ) {
        // const getAllTask = await this.taskRepository.findByConditionsByUpdateAtDescendingPaginationAndAggregateKanBanColumn(
        // 	{
        // 		user_id: userId,
        // 	},
        // 	pageNumber,
        // 	pageSize,
        // );

        const getAllTask = await this.taskRepository.findByConditions(
            {
                user_id: userId,
            },
            {
                created_at: -1,
            },
            pageNumber,
            pageSize,
            'kanban_column_id',
        );
        return getAllTask;
    }

    async countTask(userId: ObjectId) {
        const count = await this.taskRepository.countByConditions({
            user_id: userId,
        });

        return count;
    }

    async listAllTaskInKanbanColumn(
        userId: ObjectId,
        kanbanColumnId: ObjectId,
        populate: string,
    ) {
        // const getAllTaskInColumn =
        //     await this.taskRepository.findByConditionsByOrderAscending({
        //         user_id: userId,
        //         kanban_column_id: kanbanColumnId,
        //     });

        const getAllTaskInColumn = await this.taskRepository.findByConditions(
            {
                user_id: userId,
                kanban_column_id: kanbanColumnId,
            },
            {
                order: 1,
            },
            null,
            null,
            populate,
        );
        return getAllTaskInColumn;
    }

    async getAllTaskInKanbanColumn(userId: ObjectId, kanbanColumnId: ObjectId) {
        const getAllTaskInColumn = await this.listAllTaskInKanbanColumn(
            userId,
            kanbanColumnId,
            null,
        );

        return { statusCode: HttpStatus.OK, data: getAllTaskInColumn };
    }

    async listOneTask(userId: ObjectId, taskId: ObjectId) {
        const taskList = await this.taskRepository.findOne({
            user_id: userId,
            _id: taskId,
        });

        if (taskList === null) {
            throw new HttpException(
                VerbalException.TASK_NOT_FOUND,
                HttpStatus.NOT_FOUND,
            );
        }

        if (taskList.is_delete === true) {
            throw new HttpException(
                VerbalException.TASK_NOT_FOUND,
                HttpStatus.NOT_FOUND,
            );
        }

        return taskList;
    }

    async getOneTaskWithFiles(userId: ObjectId, taskId: ObjectId) {
        let taskList = await this.listOneTask(userId, taskId);

        let fileList = [];
        for (const attachment of taskList.attachments) {
            // if the user file has deleted, don't put to file list and throw Http except that file not found
            try {
                const file = await this.userFilesService.listOneFile(
                    userId,
                    attachment,
                );
                fileList.push(file);
            } catch (e) {}
        }

        taskList.attachments = fileList;

        return taskList;
    }

    async getOneTask(userId: ObjectId, taskId: ObjectId) {
        const task = await this.getOneTaskWithFiles(userId, taskId);

        return { statusCode: HttpStatus.OK, data: task };
    }

    async addTaskLocal(
        userId: ObjectId,
        passtaskInfo: PassTaskInfoDto,
        isNote: boolean,
    ) {
        const getKBColumnId =
            await this.kanbanService.getOneKBByWorkspaceAndType(
                passtaskInfo.workspace_id,
                passtaskInfo.type,
            );
        const id = getKBColumnId[0]._id;
        const kanbanColumn = await this.kanbanService.listOneKanbanColumn(
            userId,
            id,
        );
        // "kanban_column_id": "63294446394d31b0ff7c0eaf",
        // const taskSet =
        //     await this.taskRepository.findByConditionsByOrderDescending({
        //         user_id: userId,
        //         kanban_column_id: passtaskInfo.kanban_column_id,
        //     });

        const taskSet = await this.taskRepository.findByConditions(
            {
                user_id: userId,
                kanban_column_id: id,
            },
            {
                order: -1,
            },
            null,
            null,
            null,
        );

        let order = 0;
        if (taskSet.length > 0) {
            order = taskSet[0].order + 1;
        }

        const pID = kanbanColumn.workspace_id.toString();
        const workspaceId = mongoose.mongo.ObjectId(pID);

        const workspace = await this.workspaceService.listOneWorkspace(
            userId,
            workspaceId,
        );
        const newTask: TaskDto = {
            user_id: userId,
            workspace_id: workspaceId,
            kanban_column_id: id,
            task_name: passtaskInfo.task_name,
            description: passtaskInfo.description,
            attachments: passtaskInfo.attachments,
            sub_tasks: passtaskInfo.sub_tasks,
            total_time: 0,
            is_delete: false,
            is_note: isNote,
            order: order,
            updated_at: Math.floor(new Date().getTime() / 1000),
            created_at: Math.floor(new Date().getTime() / 1000),
        };

        const addTask = await this.taskRepository.create(newTask);

        if (addTask._id !== 0) {
            return addTask._id;
        }
        throw new HttpException(
            VerbalException.TASK_CANNOT_CREATE,
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }

    async taskSearch(userId: ObjectId, keyword: string) {
        try {
            const searchData = await this.taskRepository.findByConditions(
                {
                    user_id: userId,
                    is_note: false,
                    task_name: { $regex: new RegExp(keyword, 'i') },
                },
                null,
                null,
                null,
                'workspace_id',
            );

            return searchData;
        } catch (e) {
            throw new HttpException(
                VerbalException.TASKS_SEARCH_VALUE_INVALID,
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async addTask(
        userId: ObjectId,
        passtaskInfo: PassTaskInfoDto,
        isNote: boolean,
    ) {
        const addedTaskId = await this.addTaskLocal(
            userId,
            passtaskInfo,
            isNote,
        );

        return {
            statusCode: HttpStatus.CREATED,
            message: VerbalException.TASK_CREATED_SUCCESSFUL,
            data: {
                task_id: addedTaskId,
            },
        };
    }

    async addTaskAndAddToOpen(
        userId: ObjectId,
        workspaceId: ObjectId,
        taskName: string,
        description: string,
        subTask: SubTasks[],
        attachment: ObjectId[],
        isNote: boolean,
    ) {
        // find in progress column
        const kanbanColumn =
            await this.kanbanService.findKanbanColumnInWorkspaceByType(
                userId,
                workspaceId,
                KanbanColumnType.OPEN,
            );

        if (kanbanColumn == null) {
            throw new HttpException(
                VerbalException.KANBAN_COLUMN_NOT_FOUND,
                HttpStatus.NOT_FOUND,
            );
        }
        // insert new task to in progress column
        const kID = kanbanColumn._id.toString();
        const kanbanId = mongoose.mongo.ObjectId(kID);

        const passtaskInfo = {
            kanban_column_id: kanbanId,
            task_name: taskName,
            description: description,
            sub_tasks: subTask,
            attachments: attachment,
            is_note: isNote,
            workspace_id: workspaceId,
            type: KanbanColumnType.OPEN,
        };

        const addTask = await this.addTaskLocal(userId, passtaskInfo, isNote);

        return addTask;
    }

    async addTaskAndAddToInProgress(
        userId: ObjectId,
        workspaceId: ObjectId,
        taskName: string,
        description: string,
        isNote: boolean,
    ) {
        // find in progress column
        const kanbanColumn =
            await this.kanbanService.findKanbanColumnInWorkspaceByType(
                userId,
                workspaceId,
                KanbanColumnType.IN_PROGRESS,
            );

        if (kanbanColumn == null) {
            throw new HttpException(
                VerbalException.KANBAN_COLUMN_NOT_FOUND,
                HttpStatus.NOT_FOUND,
            );
        }
        // insert new task to in progress column
        const kID = kanbanColumn._id.toString();
        const kanbanId = mongoose.mongo.ObjectId(kID);

        const passtaskInfo = {
            kanban_column_id: kanbanId,
            task_name: taskName,
            description: description,
            sub_tasks: [],
            attachments: [],
            is_note: isNote,
            workspace_id: workspaceId,
            type: KanbanColumnType.IN_PROGRESS,
        };

        const addTask = await this.addTaskLocal(userId, passtaskInfo, isNote);

        return addTask;
    }

    async addTaskAndAddToInProgressReponse(
        userId: ObjectId,
        workspaceId: ObjectId,
        taskName: string,
        description: string,
    ) {
        const addedTaskId = await this.addTaskAndAddToInProgress(
            userId,
            workspaceId,
            taskName,
            description,
            false,
        );

        return {
            statusCode: HttpStatus.CREATED,
            message: VerbalException.TASK_CREATED_SUCCESSFUL,
            data: {
                task_id: addedTaskId,
            },
        };
    }

    async editTask(
        userId: ObjectId,
        taskId: ObjectId,
        passtaskInfo: PassTaskInfoDto,
    ) {
        await this.listOneTask(userId, taskId);

        const editProject = await this.taskRepository.updateByCondition(
            { _id: taskId, user_id: userId },
            passtaskInfo,
        );

        if (editProject.modifiedCount === 0) {
            throw new HttpException(
                VerbalException.DEFAULT,
                HttpStatus.NOT_MODIFIED,
            );
        }

        throw new HttpException(
            VerbalException.PROJECT_UPDATE_SUCCESS,
            HttpStatus.OK,
        );
    }

    async deleteTask(userId: ObjectId, taskId: ObjectId) {
        await this.listOneTask(userId, taskId);

        const deleteProject = await this.taskRepository.deleteByConditions({
            _id: taskId,
            user_id: userId,
        });

        throw new HttpException(VerbalException.DEFAULT, HttpStatus.NO_CONTENT);
    }

    async subTaskUpdate(
        userId: ObjectId,
        taskId: ObjectId,
        subTasks: SubTasks[],
    ) {
        await this.taskRepository.updateByCondition(
            { user_id: userId, _id: taskId },
            { sub_tasks: subTasks },
        );

        return { statusCode: HttpStatus.OK };
    }

    async attachmentUpdate(
        userId: ObjectId,
        taskId: ObjectId,
        attachments: ObjectId[],
    ) {
        const task = await this.listOneTask(userId, taskId);

        const wID = task.workspace_id.toString();
        const workspaceId = mongoose.mongo.ObjectId(wID);

        // check if attachment exist
        for (const attachmentId of attachments) {
            await this.userFilesService.updateFileWorkspace(
                userId,
                attachmentId,
                workspaceId,
            );
        }

        await this.taskRepository.updateByCondition(
            { user_id: userId, _id: taskId },
            { attachments },
        );

        return { statusCode: HttpStatus.OK };
    }

    async taskColumnChange(
        userId: ObjectId,
        taskId: ObjectId,
        newKanbanColumnId: ObjectId,
    ) {
        const resp = await this.taskRepository.updateByCondition(
            { userId, _id: taskId },
            { kanban_column_id: newKanbanColumnId },
        );
    }

    async addTimeToTask(
        userId: ObjectId,
        taskId: ObjectId,
        workspaceId: ObjectId,
        time: number,
    ) {
        const task = await this.listOneTask(userId, taskId);

        // verify if task is inside workspace
        if (task.workspace_id.toString() != workspaceId.toString()) {
            throw new HttpException(
                VerbalException.TASK_NOT_FOUND,
                HttpStatus.NOT_FOUND,
            );
        }

        let taskTotalTime = 0;
        if (task.total_time === undefined) {
            taskTotalTime = time;
        } else {
            taskTotalTime = task.total_time + time;
        }

        await this.taskRepository.updateByCondition(
            { user_id: userId, _id: taskId },
            { total_time: taskTotalTime },
        );
    }

    async movePosition(
        userId: ObjectId,
        taskId: ObjectId,
        listTaskOrderByNewPosition: ObjectId[],
    ) {
        const task = await this.listOneTask(userId, taskId);

        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }

        const unique = listTaskOrderByNewPosition.filter(onlyUnique);

        if (unique.length !== listTaskOrderByNewPosition.length) {
            throw new HttpException(
                VerbalException.TASK_LIST_IS_DUPLICATED,
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        // const getAllTaskInColumn =
        //     await this.taskRepository.findByConditionsByOrderAscending({
        //         user_id: userId,
        //         kanban_column_id: task.kanban_column_id,
        //     });

        const getAllTaskInColumn = await this.taskRepository.findByConditions(
            {
                user_id: userId,
                kanban_column_id: task.kanban_column_id,
            },
            {
                order: 1,
            },
            null,
            null,
            null,
        );

        if (unique.length !== getAllTaskInColumn.length) {
            throw new HttpException(
                VerbalException.TASK_LIST_IS_NOT_VALID_SHORTER_THAN_EXPECT,
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        for (const [index, taskOrder] of listTaskOrderByNewPosition.entries()) {
            await this.taskRepository.updateByCondition(
                {
                    _id: taskOrder,
                    kanban_column_id: task.kanban_column_id,
                    user_id: userId,
                },
                { order: index },
            );
        }

        return {
            status: HttpStatus.OK,
            message: VerbalSuccess.UPDATE_COLUMN_SUCCESS,
        };
    }

    async moveToLast(
        userId: ObjectId,
        taskId: ObjectId,
        newKanbanColumnId: ObjectId,
    ) {
        const task = await this.listOneTask(userId, taskId);

        const tskID = task.kanban_column_id.toString();
        const tId = mongoose.mongo.ObjectId(tskID);

        if (tId == newKanbanColumnId) {
            throw new HttpException(
                VerbalException.CANNOT_MOVE_TO_SAME_COLUMN,
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        const kanbanColumn = await this.kanbanService.listOneKanbanColumn(
            userId,
            newKanbanColumnId,
        );

        if (
            kanbanColumn.workspace_id.toString() !==
            task.workspace_id.toString()
        ) {
            throw new HttpException(
                VerbalException.CANNOT_MOVE_TO_DIFFERENT_WORKSPACE,
                HttpStatus.NOT_ACCEPTABLE,
            );
        }

        const getAllTaskInColumn = await this.taskRepository.findByConditions(
            {
                user_id: userId,
                kanban_column_id: newKanbanColumnId,
            },
            {
                order: -1,
            },
            1,
            1,
            null,
        );

        let lastOrder;

        if (getAllTaskInColumn.length === 0) {
            lastOrder = 0;
        } else {
            lastOrder = getAllTaskInColumn[0].order + 1;
        }

        await this.taskRepository.updateByCondition(
            {
                _id: taskId,
                user_id: userId,
            },
            {
                kanban_column_id: newKanbanColumnId,
                order: lastOrder,
            },
        );

        return {
            status: HttpStatus.OK,
            message: VerbalSuccess.UPDATE_COLUMN_SUCCESS,
        };
    }

    async updateTotalTime(
        userId: ObjectId,
        taskId: ObjectId,
        totalTime: number,
    ) {
        return this.taskRepository.updateByCondition(
            { _id: taskId, user_id: userId },
            { total_time: totalTime },
        );
    }
}
