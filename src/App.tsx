import {
  Button,
  ButtonGroup,
  Card,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Progress,
  Skeleton,
  ToastProvider,
} from '@heroui/react';
import { RefreshCcw, Save, Trash, DownloadIcon, XIcon, CheckIcon } from 'lucide-react';
import { trimPrefix, useFeatures } from './features';

export default function App() {
  const {
    open,
    setOpen,
    items,
    name,
    setName,
    del,
    setDel,
    listLoading,
    actionLoading,
    actionProgress,
    openModal,
    refresh,
    saveByName,
    loadByName,
    deleteByName,
  } = useFeatures();

  const ioLoading = actionLoading === 'save' || actionLoading === 'load' || actionLoading === 'delete';
  const progressColor = actionLoading === 'load' ? 'secondary' : actionLoading === 'delete' ? 'danger' : 'primary';
  const progressIndeterminate = actionLoading === 'delete' || !actionProgress;

  return (
    <>
      <Button className='fixed top-1 right-1 z-10000 border-0! bg-primary!' size='sm' isIconOnly onPress={openModal}>
        <Save className='w-4 h-4' />
      </Button>

      {/* 主 Modal */}
      <Modal
        isOpen={open}
        onOpenChange={setOpen}
        backdrop='blur'
        placement='center'
        size='2xl'
        className='dark text-foreground bg-background **:text-base! **:box-border! **:border-0! [&_button]:bg-transparent'
        classNames={{ backdrop: 'z-100000 [&~div]:z-100001' }}>
        <ModalContent>
          <ModalHeader className='flex! items-center gap-2'>
            <span className='text-xl font-bold'>存档管理</span>

            <Button isIconOnly size='sm' variant='light' onPress={refresh} isDisabled={listLoading || !!actionLoading}>
              <RefreshCcw className='w-4 h-4' />
            </Button>
          </ModalHeader>

          <ModalBody className='flex flex-col gap-4 p-2'>
            <div className='flex gap-2'>
              <Input
                placeholder='文件名'
                value={name}
                isClearable
                onClear={() => {
                  setName('');
                }}
                onChange={e => setName(e.target.value.replaceAll('/', '').replaceAll('\\', ''))}
                classNames={{ input: 'focus:outline-0!' }}
              />

              <Button
                onPress={() => saveByName(name)}
                isDisabled={!name.trim() || ioLoading}
                isIconOnly
                className='bg-primary!'>
                <Save className='w-4 h-4' />
              </Button>
            </div>

            {ioLoading && (
              <Progress
                aria-label='Operation progress'
                value={actionProgress?.value}
                maxValue={100}
                size='sm'
                className='w-full'
                color={progressColor}
                isIndeterminate={progressIndeterminate}
              />
            )}

            <Card>
              {listLoading &&
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className='p-3 flex gap-2'>
                    <div className='flex items-center w-full'>
                      <Skeleton className='h-8 w-full rounded-md' />
                    </div>
                    <Skeleton className='h-10 w-[80%] rounded-md' />
                  </div>
                ))}

              {!listLoading &&
                items.map(item => {
                  const fileName = trimPrefix(item.path);

                  return (
                    <div key={fileName} className='p-3 flex gap-2 flex-wrap border-divider border-b last:border-b-0'>
                      <span className='flex items-center break-all'>{decodeURIComponent(fileName)}</span>

                      <div className='ml-auto flex gap-2'>
                        <ButtonGroup size='sm' className='**:text-sm!'>
                          <Button className='bg-default!' onPress={() => loadByName(fileName)} isDisabled={ioLoading}>
                            <DownloadIcon className='w-4 h-4' />
                            加载
                          </Button>

                          <Button className='bg-primary!' onPress={() => saveByName(fileName)} isDisabled={ioLoading}>
                            <Save className='w-4 h-4' />
                            保存
                          </Button>

                          <Button className='bg-danger!' onPress={() => setDel(fileName)} isDisabled={ioLoading}>
                            <Trash className='w-4 h-4' />
                            删除
                          </Button>
                        </ButtonGroup>
                      </div>
                    </div>
                  );
                })}
            </Card>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        isOpen={!!del}
        onOpenChange={() => setDel(null)}
        placement='center'
        className='dark text-foreground bg-background **:text-base! **:box-border! **:border-0! [&_button]:bg-transparent'
        classNames={{ backdrop: 'z-100010 [&~div]:z-100011' }}>
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className='text-xl font-bold'>确认删除</ModalHeader>

              <ModalBody>删除 {decodeURIComponent(del ?? '')} ?</ModalBody>

              <ModalFooter className='flex!'>
                <Button
                  className='bg-default!'
                  onPress={() => {
                    setDel(null);
                    onClose();
                  }}
                  isDisabled={actionLoading === 'delete'}>
                  <XIcon className='w-4 h-4' />
                  取消
                </Button>

                <Button className='bg-danger!' onPress={() => del && deleteByName(del)} isDisabled={!del || ioLoading}>
                  <CheckIcon className='w-4 h-4' />
                  确认
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <div className='[&>div]:z-200000'>
        <ToastProvider placement='bottom-right'></ToastProvider>
      </div>
    </>
  );
}
